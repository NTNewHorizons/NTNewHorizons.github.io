'use strict';

const express    = require('express');
const router     = express.Router();
const fs         = require('fs');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const { marked } = require('marked');
const crypto     = require('crypto');

// ──────────────────────────────────────────────────────────────────────────────
// DATA LAYER
// ──────────────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '..', 'blog-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = {
  'admins.json':   [],
  'posts.json':    [],
  'users.json':    [],   // array — was IP-keyed object; silently migrated below
  'comments.json': {},
};

for (const [file, dflt] of Object.entries(DEFAULTS)) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(dflt, null, 2));
}

function readData(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    // Migration: old users.json was an IP-keyed object; treat as empty array
    if (file === 'users.json' && !Array.isArray(raw)) return [];
    return raw;
  } catch {
    return DEFAULTS[file] ?? null;
  }
}

function writeData(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function uniqueSlug(desired, existingPosts, excludeId) {
  const others = existingPosts.filter(p => p.id !== excludeId).map(p => p.slug);
  let slug = desired, n = 2;
  while (others.includes(slug)) slug = `${desired}-${n++}`;
  return slug;
}

function isAdmin(req)  { return !!(req.session?.adminUser); }
function isUser(req)   { return !!(req.session?.user?.id); }

function getCurrentUser(req) {
  if (!req.session?.user?.id) return null;
  const users = readData('users.json');
  return users.find(u => u.id === req.session.user.id) || null;
}

function flashGet(req) {
  const msg = req.session?.flash ?? null;
  if (req.session) delete req.session.flash;
  return msg;
}

function flashSet(req, msg) {
  if (req.session) req.session.flash = msg;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidNickname(nick) {
  return /^[a-zA-Z0-9_\- ]{1,30}$/.test(nick);
}

const NICK_COOLDOWN_DAYS = 7;

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function nickTimeRemaining(isoDate) {
  const ms = (new Date(isoDate).getTime() + NICK_COOLDOWN_DAYS * 86400000) - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isReservedNick(nick, admins) {
  const low = nick.toLowerCase();
  return admins
    .flatMap(a => [a.username, a.displayName || ''].map(n => n.toLowerCase()).filter(Boolean))
    .includes(low);
}

// ──────────────────────────────────────────────────────────────────────────────
// MARKDOWN
// ──────────────────────────────────────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

// ──────────────────────────────────────────────────────────────────────────────
// CSS  (same retro palette; additions: top nav, auth forms, profile)
// ──────────────────────────────────────────────────────────────────────────────

const BLOG_CSS = `
*{box-sizing:border-box;}
body{color:#FFF;background-color:#000;font-family:monospace;font-size:15px;margin:0;}
h1{border-style:outset;border-color:#000;}
h3{font-variant:small-caps;}
a{color:#FF8;text-decoration:none;}
a:hover{color:#FF8;text-decoration:underline;}
.return{padding:5px;border-style:outset;border-color:#FF8;background-color:#444;}
.cookies{margin:auto;width:98%;background-color:#777;border-style:outset;border-color:#aaa;text-align:center;padding-top:10px;padding-bottom:10px;}
.content{width:1000px;margin:auto;margin-top:40px;padding:20px;background-color:#777;border-style:outset;border-color:#aaa;}
.blog-panel{width:900px;height:206px;margin:auto;margin-top:20px;color:#FFF;background-color:#444;border-style:inset;border-color:#aaa;overflow:hidden;}
.blog-image{width:200px;height:200px;float:left;border-style:outset;border-color:#aaa;object-fit:cover;display:block;}
.blog-image-placeholder{width:200px;height:200px;float:left;border-style:outset;border-color:#aaa;background:#222;display:flex;align-items:center;justify-content:center;color:#555;font-size:40px;}
.blog-desc{width:648px;height:180px;padding:20px;padding-top:0;float:right;border-style:outset;border-color:#aaa;overflow:hidden;}
.blog-entry{padding:40px;padding-top:10px;background-color:#444;margin:auto;border-style:inset;border-color:#aaa;}
.blog-entry h1,.blog-entry h2,.blog-entry h3{margin:20px 0 8px;}
.blog-entry h1{border-bottom:1px solid #666;}
.blog-entry p{margin:8px 0;}
.blog-entry ul,.blog-entry ol{margin:8px 0 8px 30px;}
.blog-entry li{margin:3px 0;}
.blog-entry img{max-width:100%;display:block;margin:10px auto;border-style:inset;border-color:#aaa;}
.blog-entry code{background:#222;padding:2px 5px;border-radius:2px;}
.blog-entry pre{background:#222;padding:12px;overflow-x:auto;border-left:3px solid #FF8;margin:10px 0;}
.blog-entry pre code{background:none;padding:0;}
.blog-entry blockquote{border-left:3px solid #FF8;margin:10px 0 10px 10px;padding-left:15px;color:#ddd;}
.blog-entry table{border-collapse:collapse;width:100%;margin:10px 0;}
.blog-entry th,.blog-entry td{border:1px solid #aaa;padding:6px 10px;}
.blog-entry th{background:#333;}
.blog-entry hr{border:none;border-top:1px solid #555;margin:20px 0;}
.blog-entry a{color:#FF8;}

/* comments */
.comments{padding:20px 40px;background-color:#333;margin-top:0;border-style:inset;border-color:#aaa;}
.comment{border-bottom:1px solid #555;padding:12px 0;position:relative;overflow:hidden;}
.comment:last-of-type{border-bottom:none;}
.comment-nick{color:#FF8;font-weight:bold;}
.comment-date{color:#aaa;font-size:12px;margin-left:10px;}
.comment-own{font-size:11px;color:#4F4;margin-left:8px;}
.comment-text{margin-top:6px;white-space:pre-wrap;word-break:break-word;}
.comment-del{float:right;background:#333;color:#F88;border:1px solid #F44;font-family:monospace;font-size:11px;padding:2px 7px;cursor:pointer;}
.comment-del:hover{background:#400;}
.comment-form{margin-top:20px;}
.comment-form textarea{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:14px;padding:6px;width:100%;box-sizing:border-box;margin-bottom:8px;resize:vertical;}
.comment-form button{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;padding:6px 16px;cursor:pointer;}
.comment-form button:hover{background:#555;}
.comment-gate{margin-top:20px;padding:14px 20px;background:#222;border:1px solid #555;color:#aaa;}
.comment-gate a{color:#FF8;}

/* flash messages */
.msg{padding:8px 12px;margin:10px 0;background:#333;border-left:3px solid #FF8;}
.msg.error{border-color:#F44;color:#F88;}
.msg.ok{border-color:#4F4;color:#8F8;}
.msg.info{border-color:#88F;color:#aaf;}

/* sticky nav bar */
.blog-topnav{background:#111;border-bottom:2px solid #FF8;padding:0 16px;display:flex;align-items:stretch;min-height:36px;font-size:13px;position:sticky;top:0;z-index:50;}
.blog-topnav a,.blog-topnav button{color:#FF8;text-decoration:none;padding:0 12px;display:flex;align-items:center;background:none;border:none;border-right:1px solid #333;font-family:monospace;font-size:13px;cursor:pointer;white-space:nowrap;}
.blog-topnav a:hover,.blog-topnav button:hover{background:#222;text-decoration:none;}
.blog-topnav .tnav-brand{font-weight:bold;border-right:1px solid #FF8;}
.blog-topnav .tnav-right{margin-left:auto;display:flex;align-items:stretch;}
.blog-topnav .tnav-right a,.blog-topnav .tnav-right button{border-right:none;border-left:1px solid #333;}
.blog-topnav .tnav-user{color:#4F4;padding:0 12px;display:flex;align-items:center;border-left:1px solid #333;font-weight:bold;}
.blog-topnav .tnav-logout{color:#F88 !important;}

/* auth forms */
.auth-wrap{width:460px;margin:50px auto;background:#333;border-style:outset;border-color:#aaa;padding:28px 32px;}
.auth-wrap h2{margin-bottom:18px;font-variant:small-caps;border-bottom:1px solid #555;padding-bottom:8px;}
.field-group{margin-bottom:14px;}
.field-label{display:block;font-size:13px;color:#ccc;margin-bottom:4px;}
.field-hint{display:block;font-size:11px;color:#888;margin-top:3px;}
.auth-input{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:14px;padding:6px 8px;width:100%;box-sizing:border-box;}
.auth-input:focus{outline:none;border-color:#FF8;}
.auth-submit{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;font-size:14px;padding:8px 20px;cursor:pointer;}
.auth-submit:hover{background:#555;}
.auth-submit.full{width:100%;}
.auth-switch{margin-top:16px;font-size:13px;color:#aaa;text-align:center;}
.auth-switch a{color:#FF8;}

/* profile */
.profile-wrap{width:700px;margin:40px auto;background:#333;border-style:outset;border-color:#aaa;padding:28px 32px;}
.profile-wrap h2{margin-bottom:6px;}
.profile-section{margin-top:22px;padding-top:18px;border-top:1px solid #555;}
.profile-section h3{margin-bottom:12px;}
.profile-stat{display:inline-block;background:#444;border:1px solid #666;padding:5px 14px;margin:0 6px 6px 0;font-size:13px;}
.nick-cooldown{color:#F88;font-size:13px;margin-top:8px;padding:8px 12px;background:#222;border:1px solid #F44;}

/* admin */
.admin-wrap{width:1100px;margin:30px auto;background:#333;border-style:outset;border-color:#aaa;padding:28px 30px;box-sizing:border-box;}
.admin-wrap table{border-collapse:collapse;width:100%;margin-bottom:16px;}
.admin-wrap th,.admin-wrap td{border:1px solid #555;padding:6px 10px;text-align:left;vertical-align:top;}
.admin-wrap th{background:#222;color:#FF8;}
.admin-input{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:13px;padding:4px 6px;box-sizing:border-box;}
.admin-input:focus{outline:none;border-color:#FF8;}
.admin-btn{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;padding:6px 16px;cursor:pointer;}
.admin-btn:hover{background:#555;}
.admin-btn.danger{color:#F88;border-color:#F44;}
.admin-btn.small{padding:2px 8px;font-size:12px;}
.login-box{width:380px;margin:100px auto;background:#333;border-style:outset;border-color:#aaa;padding:28px;}
.preview-wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.preview-pane{background:#444;padding:16px;overflow-y:auto;max-height:400px;border-style:inset;border-color:#aaa;}
.admin-tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #FF8;}
.admin-tab{padding:6px 18px;background:#222;color:#aaa;border:1px solid #555;border-bottom:none;font-family:monospace;cursor:pointer;font-size:13px;}
.admin-tab.active,.admin-tab:hover{background:#444;color:#FF8;}
.admin-panel{display:none;}
.admin-panel.active{display:block;}

/* responsive */
@media(max-width:1140px){.admin-wrap{width:98%;}}
@media(max-width:1020px){.content,.blog-panel{width:98%;}}
@media(max-width:720px){
  .profile-wrap,.auth-wrap{width:98%;margin:20px auto;padding:20px;}
  .blog-panel{height:auto;}
  .blog-image,.blog-image-placeholder{float:none;width:100%;height:140px;}
  .blog-desc{float:none;width:100%;height:auto;}
}
`;

// ──────────────────────────────────────────────────────────────────────────────
// PAGE SHELL + NAVIGATION BAR
// ──────────────────────────────────────────────────────────────────────────────

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${BLOG_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function topNav(req) {
  const user  = getCurrentUser(req);
  const admin = req.session?.adminUser;
  let right = '';
  if (admin) {
    right = `
      <span class="tnav-user">&#9733; ${escapeHtml(admin.displayName || admin.username)}</span>
      <a href="/blog/admin">Admin Panel</a>
      <form method="POST" action="/blog/admin/logout" style="display:contents;">
        <button type="submit" class="tnav-logout">[Logout]</button>
      </form>`;
  } else if (user) {
    right = `
      <span class="tnav-user">${escapeHtml(user.nickname)}</span>
      <a href="/blog/profile">Profile</a>
      <form method="POST" action="/blog/user/logout" style="display:contents;">
        <button type="submit" class="tnav-logout">[Logout]</button>
      </form>`;
  } else {
    right = `<a href="/blog/login">[Login]</a><a href="/blog/register">[Register]</a>`;
  }
  return `<nav class="blog-topnav">
  <a href="/blog" class="tnav-brand">&#9762; NT:NH Blog</a>
  <a href="/">&larr; Main Site</a>
  <div class="tnav-right">${right}</div>
</nav>`;
}

function blogImageEl(imageUrl) {
  if (imageUrl) return `<img src="${escapeHtml(imageUrl)}" class="blog-image" alt="" loading="lazy" />`;
  return `<div class="blog-image-placeholder">&#9762;</div>`;
}

function flashHtml(flash) {
  if (!flash) return '';
  const cls = flash.startsWith('Error') ? 'error' : flash.startsWith('Info') ? 'info' : 'ok';
  return `<div class="msg ${cls}">${escapeHtml(flash)}</div>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC BLOG ROUTES
// ──────────────────────────────────────────────────────────────────────────────

// GET /blog  — post listing
router.get('/', (req, res) => {
  const posts = readData('posts.json')
    .filter(p => p.published)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const flash   = flashGet(req);
  const allComs = readData('comments.json');

  const panels = posts.length
    ? posts.map(p => {
        const count = (allComs[p.slug] || []).length;
        return `
<div class="blog-panel">
  ${blogImageEl(p.imageUrl)}
  <div class="blog-desc">
    <h3><a href="/blog/post/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h3>
    ${escapeHtml(p.date)} &middot; ${count} comment${count !== 1 ? 's' : ''}<hr>
    ${escapeHtml(p.summary || '')}
  </div>
</div>`;
      }).join('\n')
    : '<p style="margin-top:20px;color:#222;">No posts yet &mdash; check back soon.</p>';

  res.send(page('NT:NH Dev Blog', `
${topNav(req)}
<div class="content">
  <h1 style="text-align:center;">NT:NH Dev Blog</h1>
  <p>The official development blog for Nuclear Tech: New Horizons.</p>
  ${flashHtml(flash)}
  ${panels}
</div>`));
});

// GET /blog/post/:slug  — single post
router.get('/post/:slug', (req, res) => {
  const posts = readData('posts.json');
  const post  = posts.find(p => p.slug === req.params.slug && p.published);
  if (!post) return res.status(404).send(page('Not Found', `
${topNav(req)}
<div class="content"><h1>404</h1><p>Post not found.</p><br>
<a href="/blog" class="return">&lt; Back to blog</a></div>`));

  const user     = getCurrentUser(req);
  const admin    = req.session?.adminUser;
  const flash    = flashGet(req);
  const allComs  = readData('comments.json');
  const comments = allComs[req.params.slug] || [];

  const commentsHtml = comments.length
    ? comments.map(c => {
        const isOwn  = user && user.id === c.userId;
        const canDel = !!(admin || isOwn);
        const delBtn = canDel
          ? `<form method="POST"
               action="/blog/post/${escapeHtml(post.slug)}/comment/${escapeHtml(c.id)}/delete"
               style="display:inline;" onsubmit="return confirm('Delete this comment?')">
               <button class="comment-del" type="submit">[delete]</button>
             </form>`
          : '';
        return `
<div class="comment" id="c-${escapeHtml(c.id)}">
  ${delBtn}
  <span class="comment-nick">${escapeHtml(c.nickname)}</span>
  ${isOwn ? '<span class="comment-own">(you)</span>' : ''}
  <span class="comment-date">${new Date(c.date).toLocaleString('en-GB')}</span>
  <div class="comment-text">${escapeHtml(c.content)}</div>
</div>`;
      }).join('\n')
    : '<p style="color:#aaa;margin:12px 0;">No comments yet. Be the first!</p>';

  const commentFormHtml = user
    ? `<div class="comment-form" style="margin-top:20px;">
         <hr>
         <p>Commenting as <b style="color:#4F4;">${escapeHtml(user.nickname)}</b>
            &mdash; <a href="/blog/profile">change nickname</a></p>
         <form method="POST" action="/blog/post/${escapeHtml(post.slug)}/comment">
           <textarea name="content" rows="5" maxlength="2000"
             placeholder="Write a comment... (max 2000 characters)"></textarea>
           <button type="submit">Post Comment</button>
         </form>
       </div>`
    : `<div class="comment-gate">
         <b>Want to join the discussion?</b><br>
         <a href="/blog/login">[Login]</a> &nbsp; or &nbsp;
         <a href="/blog/register">[Create a free account]</a> to leave a comment.
       </div>`;

  res.send(page(`${post.title} \u2014 NT:NH Blog`, `
${topNav(req)}
<div class="content">
  <h1 style="text-align:center;">${escapeHtml(post.title)}</h1>
  <div class="blog-entry">
    <h3>${escapeHtml(post.authorDisplay || post.author)} &mdash; ${escapeHtml(post.date)}</h3>
    ${marked(post.content || '')}
  </div>
  <div class="comments" id="comments">
    <h3>Comments (${comments.length})</h3>
    ${flashHtml(flash)}
    ${commentsHtml}
    ${commentFormHtml}
  </div>
  <br>
  <a class="return" href="/blog">&lt; Back to blog</a>
</div>`));
});

// POST /blog/post/:slug/comment
router.post('/post/:slug/comment', (req, res) => {
  const slug = req.params.slug;

  if (!isUser(req)) {
    flashSet(req, 'Error: You must be logged in to post a comment.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const posts = readData('posts.json');
  if (!posts.find(p => p.slug === slug && p.published))
    return res.status(404).send('Post not found.');

  const content = (req.body.content || '').trim();
  if (!content || content.length > 2000) {
    flashSet(req, 'Error: Comment must be 1\u20132000 characters.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const all = readData('comments.json');
  if (!all[slug]) all[slug] = [];
  all[slug].push({
    id:       crypto.randomBytes(8).toString('hex'),
    userId:   user.id,
    nickname: user.nickname,   // snapshot at time of posting
    content,
    date:     new Date().toISOString(),
  });
  writeData('comments.json', all);

  flashSet(req, 'Comment posted!');
  res.redirect(`/blog/post/${slug}#comments`);
});

// POST /blog/post/:slug/comment/:commentId/delete
router.post('/post/:slug/comment/:commentId/delete', (req, res) => {
  const { slug, commentId } = req.params;
  const user  = getCurrentUser(req);
  const admin = req.session?.adminUser;

  if (!user && !admin) {
    flashSet(req, 'Error: Not authorised.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const all     = readData('comments.json');
  const list    = all[slug] || [];
  const comment = list.find(c => c.id === commentId);
  if (!comment) return res.redirect(`/blog/post/${slug}#comments`);

  if (!admin && (!user || user.id !== comment.userId)) {
    flashSet(req, 'Error: Not authorised to delete this comment.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  all[slug] = list.filter(c => c.id !== commentId);
  writeData('comments.json', all);

  flashSet(req, 'Comment deleted.');
  res.redirect(`/blog/post/${slug}#comments`);
});

// ──────────────────────────────────────────────────────────────────────────────
// USER AUTH — REGISTER
// ──────────────────────────────────────────────────────────────────────────────

router.get('/register', (req, res) => {
  if (isUser(req) || isAdmin(req)) return res.redirect('/blog');
  const flash = flashGet(req);
  res.send(page('Create Account \u2014 NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Create Account</h2>
  ${flashHtml(flash)}
  <form method="POST" action="/blog/register" autocomplete="on">
    <div class="field-group">
      <label class="field-label" for="r-email">Email address</label>
      <input class="auth-input" id="r-email" type="email" name="email"
             maxlength="200" autocomplete="email" required placeholder="you@example.com" />
      <span class="field-hint">Used to log in. Never shown publicly.</span>
    </div>
    <div class="field-group">
      <label class="field-label" for="r-nick">Nickname</label>
      <input class="auth-input" id="r-nick" type="text" name="nickname"
             maxlength="30" autocomplete="username" required placeholder="CoolPlayer123" />
      <span class="field-hint">Your public display name (1&ndash;30 chars, letters / numbers / spaces / _ -).</span>
    </div>
    <div class="field-group">
      <label class="field-label" for="r-pw">Password</label>
      <input class="auth-input" id="r-pw" type="password" name="password"
             autocomplete="new-password" required placeholder="At least 8 characters" />
    </div>
    <div class="field-group">
      <label class="field-label" for="r-pw2">Confirm password</label>
      <input class="auth-input" id="r-pw2" type="password" name="password2"
             autocomplete="new-password" required placeholder="Repeat your password" />
    </div>
    <button class="auth-submit full" type="submit">[ CREATE ACCOUNT ]</button>
  </form>
  <div class="auth-switch">
    Already have an account? <a href="/blog/login">[Login]</a><br><br>
    <a href="/blog">&lt; Back to blog</a>
  </div>
</div>`));
});

router.post('/register', async (req, res) => {
  if (isUser(req)) return res.redirect('/blog');

  const email     = (req.body.email     || '').trim().toLowerCase();
  const nickname  = (req.body.nickname  || '').trim();
  const password  = (req.body.password  || '');
  const password2 = (req.body.password2 || '');

  if (!isValidEmail(email)) {
    flashSet(req, 'Error: Please enter a valid email address.');
    return res.redirect('/blog/register');
  }
  if (!isValidNickname(nickname)) {
    flashSet(req, 'Error: Nickname must be 1\u201330 characters (letters, numbers, spaces, _ -).');
    return res.redirect('/blog/register');
  }
  if (password.length < 8) {
    flashSet(req, 'Error: Password must be at least 8 characters.');
    return res.redirect('/blog/register');
  }
  if (password !== password2) {
    flashSet(req, 'Error: Passwords do not match.');
    return res.redirect('/blog/register');
  }

  const users  = readData('users.json');
  const admins = readData('admins.json');

  if (users.find(u => u.email === email)) {
    flashSet(req, 'Error: An account with that email already exists.');
    return res.redirect('/blog/register');
  }
  if (isReservedNick(nickname, admins)) {
    flashSet(req, 'Error: That nickname is reserved.');
    return res.redirect('/blog/register');
  }
  if (users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
    flashSet(req, 'Error: That nickname is already taken. Please choose another.');
    return res.redirect('/blog/register');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    id:                crypto.randomBytes(12).toString('hex'),
    email,
    nickname,
    passwordHash,
    registeredAt:      new Date().toISOString(),
    nicknameChangedAt: null,
  };

  users.push(newUser);
  writeData('users.json', users);

  req.session.user = { id: newUser.id };
  flashSet(req, `Welcome, ${nickname}! Your account has been created.`);
  res.redirect('/blog');
});

// ──────────────────────────────────────────────────────────────────────────────
// USER AUTH — LOGIN / LOGOUT
// ──────────────────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (isUser(req) || isAdmin(req)) return res.redirect('/blog');
  const flash = flashGet(req);
  res.send(page('Login \u2014 NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Login</h2>
  ${flashHtml(flash)}
  <form method="POST" action="/blog/login" autocomplete="on">
    <div class="field-group">
      <label class="field-label" for="l-email">Email address</label>
      <input class="auth-input" id="l-email" type="email" name="email"
             autocomplete="email" required placeholder="you@example.com" />
    </div>
    <div class="field-group">
      <label class="field-label" for="l-pw">Password</label>
      <input class="auth-input" id="l-pw" type="password" name="password"
             autocomplete="current-password" required placeholder="Your password" />
    </div>
    <button class="auth-submit full" type="submit">[ LOGIN ]</button>
  </form>
  <div class="auth-switch">
    No account yet? <a href="/blog/register">[Create one &mdash; it&apos;s free]</a><br><br>
    <a href="/blog">&lt; Back to blog</a>
  </div>
</div>`));
});

router.post('/login', async (req, res) => {
  if (isUser(req)) return res.redirect('/blog');

  const email    = (req.body.email    || '').trim().toLowerCase();
  const password = (req.body.password || '');
  const FAIL     = 'Error: Invalid email or password.';

  const users = readData('users.json');
  const user  = users.find(u => u.email === email);

  if (!user) {
    // constant-time dummy compare to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    flashSet(req, FAIL);
    return res.redirect('/blog/login');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { flashSet(req, FAIL); return res.redirect('/blog/login'); }

  req.session.user = { id: user.id };
  flashSet(req, `Welcome back, ${user.nickname}!`);
  res.redirect('/blog');
});

router.post('/user/logout', (req, res) => {
  delete req.session.user;
  flashSet(req, 'You have been logged out.');
  res.redirect('/blog');
});

// ──────────────────────────────────────────────────────────────────────────────
// USER PROFILE
// ──────────────────────────────────────────────────────────────────────────────

router.get('/profile', (req, res) => {
  if (!isUser(req)) {
    flashSet(req, 'Error: You must be logged in to view your profile.');
    return res.redirect('/blog/login');
  }

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const flash = flashGet(req);

  const allComs = readData('comments.json');
  let commentCount = 0;
  for (const list of Object.values(allComs)) {
    commentCount += list.filter(c => c.userId === user.id).length;
  }

  const canChangeNick = daysSince(user.nicknameChangedAt) >= NICK_COOLDOWN_DAYS;
  const remaining     = canChangeNick ? null : nickTimeRemaining(user.nicknameChangedAt);

  const nickSection = canChangeNick
    ? `<form method="POST" action="/blog/profile/nickname" style="margin-top:10px;">
         <div class="field-group">
           <label class="field-label">New nickname</label>
           <input class="auth-input" type="text" name="nickname" maxlength="30"
                  value="${escapeHtml(user.nickname)}" required />
           <span class="field-hint">Letters, numbers, spaces, _ and - only.</span>
         </div>
         <button class="auth-submit" type="submit">[ CHANGE NICKNAME ]</button>
       </form>`
    : `<div class="nick-cooldown">
         &#9203; You can change your nickname again in <b>${remaining}</b>.
         (Cooldown: once every ${NICK_COOLDOWN_DAYS} days)
       </div>`;

  res.send(page('Your Profile \u2014 NT:NH Blog', `
${topNav(req)}
<div class="profile-wrap">
  <h2>Your Profile</h2>
  <hr style="border-color:#555;">
  ${flashHtml(flash)}

  <p><b>Nickname:</b> &nbsp;${escapeHtml(user.nickname)}</p>
  <p><b>Email:</b> &nbsp;${escapeHtml(user.email)}</p>
  <p><b>Member since:</b> &nbsp;${new Date(user.registeredAt).toLocaleDateString('en-GB', {year:'numeric',month:'long',day:'numeric'})}</p>
  <p style="margin-top:10px;">
    <span class="profile-stat">Comments posted: ${commentCount}</span>
  </p>

  <div class="profile-section">
    <h3>Change Nickname</h3>
    <p style="color:#aaa;font-size:13px;">Nicknames can be changed once every ${NICK_COOLDOWN_DAYS} days.</p>
    ${nickSection}
  </div>

  <div class="profile-section">
    <h3>Change Password</h3>
    <form method="POST" action="/blog/profile/password">
      <div class="field-group">
        <label class="field-label">Current password</label>
        <input class="auth-input" type="password" name="currentPassword"
               autocomplete="current-password" required />
      </div>
      <div class="field-group">
        <label class="field-label">New password</label>
        <input class="auth-input" type="password" name="newPassword"
               autocomplete="new-password" minlength="8" required
               placeholder="At least 8 characters" />
      </div>
      <div class="field-group">
        <label class="field-label">Confirm new password</label>
        <input class="auth-input" type="password" name="newPassword2"
               autocomplete="new-password" required />
      </div>
      <button class="auth-submit" type="submit">[ CHANGE PASSWORD ]</button>
    </form>
  </div>

  <br>
  <a href="/blog" class="return">&lt; Back to blog</a>
</div>`));
});

// POST /blog/profile/nickname
router.post('/profile/nickname', (req, res) => {
  if (!isUser(req)) return res.redirect('/blog/login');

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const newNick = (req.body.nickname || '').trim();

  if (!isValidNickname(newNick)) {
    flashSet(req, 'Error: Nickname must be 1\u201330 characters (letters, numbers, spaces, _ -).');
    return res.redirect('/blog/profile');
  }
  if (daysSince(user.nicknameChangedAt) < NICK_COOLDOWN_DAYS) {
    flashSet(req, `Error: Nickname cooldown active \u2014 try again in ${nickTimeRemaining(user.nicknameChangedAt)}.`);
    return res.redirect('/blog/profile');
  }

  const users  = readData('users.json');
  const admins = readData('admins.json');

  if (isReservedNick(newNick, admins)) {
    flashSet(req, 'Error: That nickname is reserved.');
    return res.redirect('/blog/profile');
  }
  if (users.find(u => u.id !== user.id && u.nickname.toLowerCase() === newNick.toLowerCase())) {
    flashSet(req, 'Error: That nickname is already taken.');
    return res.redirect('/blog/profile');
  }

  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) { req.session.destroy(); return res.redirect('/blog/login'); }

  users[idx].nickname          = newNick;
  users[idx].nicknameChangedAt = new Date().toISOString();
  writeData('users.json', users);

  flashSet(req, `Nickname changed to "${newNick}". Next change available in ${NICK_COOLDOWN_DAYS} days.`);
  res.redirect('/blog/profile');
});

// POST /blog/profile/password
router.post('/profile/password', async (req, res) => {
  if (!isUser(req)) return res.redirect('/blog/login');

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const currentPassword = req.body.currentPassword || '';
  const newPassword     = req.body.newPassword     || '';
  const newPassword2    = req.body.newPassword2    || '';

  if (newPassword.length < 8) {
    flashSet(req, 'Error: New password must be at least 8 characters.');
    return res.redirect('/blog/profile');
  }
  if (newPassword !== newPassword2) {
    flashSet(req, 'Error: New passwords do not match.');
    return res.redirect('/blog/profile');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    flashSet(req, 'Error: Current password is incorrect.');
    return res.redirect('/blog/profile');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  const users   = readData('users.json');
  const idx     = users.findIndex(u => u.id === user.id);
  if (idx === -1) { req.session.destroy(); return res.redirect('/blog/login'); }

  users[idx].passwordHash = newHash;
  writeData('users.json', users);

  flashSet(req, 'Password changed successfully.');
  res.redirect('/blog/profile');
});

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────────────────────────────────────────────────

router.get('/admin', (req, res) => {
  if (!isAdmin(req)) return renderAdminLogin(res);
  renderAdminDashboard(req, res, null, 'posts');
});

router.get('/admin/edit/:id', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/blog/admin');
  const posts = readData('posts.json');
  const post  = posts.find(p => p.id === req.params.id);
  if (!post) { flashSet(req, 'Error: Post not found.'); return res.redirect('/blog/admin'); }
  renderAdminDashboard(req, res, post, 'posts');
});

router.get('/admin/users', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/blog/admin');
  renderAdminDashboard(req, res, null, 'users');
});

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admins = readData('admins.json');
  const admin  = admins.find(a => a.username === username);
  if (!admin || !password) return renderAdminLogin(res, 'Invalid credentials.');
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return renderAdminLogin(res, 'Invalid credentials.');
  req.session.adminUser = { username: admin.username, displayName: admin.displayName || admin.username };
  res.redirect('/blog/admin');
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/blog/admin'));
});

router.post('/admin/post', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const { id, action, title, slug: rawSlug, date, summary, imageUrl, content, published } = req.body || {};
  const posts = readData('posts.json');

  if (action === 'delete' && id) {
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) { posts.splice(idx, 1); writeData('posts.json', posts); }
    return res.redirect('/blog/admin');
  }

  if (!title?.trim()) {
    flashSet(req, 'Error: Title is required.');
    return res.redirect(id ? `/blog/admin/edit/${id}` : '/blog/admin');
  }

  const desiredSlug = rawSlug?.trim() || slugify(title.trim());
  const finalSlug   = uniqueSlug(desiredSlug, posts, id || null);
  const admin       = req.session.adminUser;

  if (id) {
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) {
      posts[idx] = {
        ...posts[idx],
        title:       title.trim(),
        slug:        finalSlug,
        date:        date || posts[idx].date,
        summary:     (summary || '').trim(),
        imageUrl:    (imageUrl || '').trim(),
        content:     content || '',
        published:   published === 'on',
        updatedAt:   new Date().toISOString(),
        updatedBy:   admin.username,
      };
    } else {
      flashSet(req, 'Error: Post not found for editing.');
      return res.redirect('/blog/admin');
    }
  } else {
    posts.unshift({
      id:            crypto.randomBytes(8).toString('hex'),
      slug:          finalSlug,
      title:         title.trim(),
      date:          date || new Date().toISOString().slice(0, 10),
      author:        admin.username,
      authorDisplay: admin.displayName,
      summary:       (summary || '').trim(),
      imageUrl:      (imageUrl || '').trim(),
      content:       content || '',
      published:     published === 'on',
      createdAt:     new Date().toISOString(),
    });
  }

  writeData('posts.json', posts);
  res.redirect('/blog/admin');
});

// Admin: delete a user account
router.post('/admin/users/delete', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');
  const { userId } = req.body || {};
  if (!userId) return res.redirect('/blog/admin/users');

  const users = readData('users.json');
  const idx   = users.findIndex(u => u.id === userId);
  if (idx !== -1) { users.splice(idx, 1); writeData('users.json', users); }

  flashSet(req, 'User account deleted.');
  res.redirect('/blog/admin/users');
});

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN PAGE RENDERERS
// ──────────────────────────────────────────────────────────────────────────────

function renderAdminLogin(res, error = '') {
  res.send(page('Blog Admin \u2014 NT:NH', `
<div class="login-box">
  <h2 style="margin-bottom:16px;font-variant:small-caps;">Admin Login</h2>
  ${error ? `<div class="msg error">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/blog/admin/login">
    <p>Username:<br>
    <input class="admin-input" style="width:100%;margin-top:4px;" type="text"
           name="username" autocomplete="username" required /></p>
    <p>Password:<br>
    <input class="admin-input" style="width:100%;margin-top:4px;" type="password"
           name="password" autocomplete="current-password" required /></p>
    <button class="admin-btn" type="submit" style="width:100%;margin-top:8px;">[ LOGIN ]</button>
  </form>
  <br><a href="/blog">&lt; Back to blog</a>
</div>`));
}

function renderAdminDashboard(req, res, editPost, activeTab) {
  const admin  = req.session.adminUser;
  const posts  = readData('posts.json').sort((a, b) => new Date(b.date) - new Date(a.date));
  const users  = readData('users.json');
  const flash  = flashGet(req);
  const today  = new Date().toISOString().slice(0, 10);

  // Post rows
  const postRows = posts.length
    ? posts.map(p => `
<tr>
  <td>${escapeHtml(p.date)}</td>
  <td>${p.published
    ? `<a href="/blog/post/${escapeHtml(p.slug)}" target="_blank">${escapeHtml(p.title)}</a>`
    : `<span style="color:#888;">${escapeHtml(p.title)} [draft]</span>`}</td>
  <td>${escapeHtml(p.authorDisplay || p.author)}</td>
  <td>${p.published ? '<span style="color:#4F4;">Yes</span>' : '<span style="color:#F88;">Draft</span>'}</td>
  <td>
    <a href="/blog/admin/edit/${escapeHtml(p.id)}" class="admin-btn small">[Edit]</a>
    &nbsp;
    <form method="POST" action="/blog/admin/post" style="display:inline;"
          onsubmit="return confirm('Delete this post?')">
      <input type="hidden" name="id" value="${escapeHtml(p.id)}" />
      <input type="hidden" name="action" value="delete" />
      <button type="submit" class="admin-btn small danger">[Delete]</button>
    </form>
  </td>
</tr>`).join('\n')
    : '<tr><td colspan="5" style="color:#aaa;">No posts yet.</td></tr>';

  // User rows
  const allComs = readData('comments.json');
  const userRows = users.length
    ? users.map(u => {
        let count = 0;
        for (const list of Object.values(allComs)) count += list.filter(c => c.userId === u.id).length;
        return `
<tr>
  <td style="font-size:12px;color:#aaa;">${escapeHtml(u.id.slice(0,10))}&hellip;</td>
  <td><b>${escapeHtml(u.nickname)}</b></td>
  <td style="font-size:12px;">${escapeHtml(u.email)}</td>
  <td style="font-size:12px;">${new Date(u.registeredAt).toLocaleDateString('en-GB')}</td>
  <td>${count}</td>
  <td>
    <form method="POST" action="/blog/admin/users/delete" style="display:inline;"
          onsubmit="return confirm('Delete user &quot;${escapeHtml(u.nickname).replace(/'/g, "\\'")} &quot;?')">
      <input type="hidden" name="userId" value="${escapeHtml(u.id)}" />
      <button type="submit" class="admin-btn small danger">[Delete]</button>
    </form>
  </td>
</tr>`;
      }).join('\n')
    : '<tr><td colspan="6" style="color:#aaa;">No registered users yet.</td></tr>';

  // Editor
  const ep    = editPost || {};
  const isNew = !ep.id;

  const editor = `
<h3 style="margin-top:0;">${isNew ? 'New Post' : `Editing: ${escapeHtml(ep.title || '')}`}</h3>
<form method="POST" action="/blog/admin/post" id="postForm">
  ${ep.id ? `<input type="hidden" name="id" value="${escapeHtml(ep.id)}" />` : ''}
  <table>
    <tr>
      <td style="width:110px;">Title *</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="title"
          value="${escapeHtml(ep.title || '')}" required id="titleInput" /></td>
    </tr>
    <tr>
      <td>Slug</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="slug"
          value="${escapeHtml(ep.slug || '')}" id="slugInput"
          placeholder="auto-generated from title if blank" /></td>
    </tr>
    <tr>
      <td>Date</td>
      <td><input class="admin-input" type="date" name="date"
          value="${escapeHtml(ep.date || today)}" /></td>
    </tr>
    <tr>
      <td>Image URL</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="imageUrl"
          value="${escapeHtml(ep.imageUrl || '')}"
          placeholder="https://... or /resources/screenshots/screenshot1.png" /></td>
    </tr>
    <tr>
      <td>Summary</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="summary"
          value="${escapeHtml(ep.summary || '')}" maxlength="300"
          placeholder="Short description shown on the listing page" /></td>
    </tr>
    <tr>
      <td>Published</td>
      <td><label><input type="checkbox" name="published" ${ep.published ? 'checked' : ''} />
          &nbsp;Published (unchecked = draft, hidden from readers)</label></td>
    </tr>
  </table>
  <br>
  <b>Content (Markdown):</b>
  <div class="preview-wrap" style="margin-top:8px;">
    <div>
      <div style="color:#aaa;font-size:12px;margin-bottom:4px;">Editor</div>
      <textarea name="content" id="mdEditor" rows="24"
        style="width:100%;background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:13px;padding:8px;box-sizing:border-box;resize:vertical;"
        oninput="updatePreview()">${escapeHtml(ep.content || '')}</textarea>
    </div>
    <div>
      <div style="color:#aaa;font-size:12px;margin-bottom:4px;">Preview</div>
      <div class="preview-pane blog-entry" id="mdPreview"></div>
    </div>
  </div>
  <br>
  <button class="admin-btn" type="submit">[ ${isNew ? 'SAVE POST' : 'SAVE CHANGES'} ]</button>
  &nbsp;
  ${!isNew ? `<a href="/blog/admin">Cancel</a>` : ''}
</form>

<script>
${isNew ? `
document.getElementById('titleInput').addEventListener('input', function() {
  var s = document.getElementById('slugInput');
  if (!s._edited) s.value = this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
});
document.getElementById('slugInput').addEventListener('input', function() { this._edited = true; });
` : ''}
(function() {
  var ms = document.createElement('script');
  ms.src = 'https://cdn.jsdelivr.net/npm/marked@9/marked.min.js';
  ms.onload = function() { updatePreview(); };
  document.head.appendChild(ms);
})();
function updatePreview() {
  var src = document.getElementById('mdEditor').value;
  var pv  = document.getElementById('mdPreview');
  if (window.marked && pv) pv.innerHTML = window.marked.parse(src, {gfm:true, breaks:true});
}
</script>`;

  res.send(page('Blog Admin \u2014 NT:NH', `
${topNav(req)}
<div class="admin-wrap">
  <h2 style="margin-bottom:4px;">Blog Admin Panel</h2>
  <p style="font-size:13px;color:#aaa;margin-bottom:16px;">
    Logged in as <b style="color:#4F4;">${escapeHtml(admin.displayName || admin.username)}</b>
    &nbsp;&mdash;&nbsp;
    <form method="POST" action="/blog/admin/logout" style="display:inline;">
      <button type="submit" class="admin-btn small danger">[Logout]</button>
    </form>
    &nbsp;&mdash;&nbsp;
    <a href="/blog">View blog</a>
  </p>

  ${flashHtml(flash)}

  <div class="admin-tabs">
    <button class="admin-tab${activeTab==='posts'?' active':''}" data-tab="posts"
            onclick="switchTab('posts')">Posts (${posts.length})</button>
    <button class="admin-tab${activeTab==='users'?' active':''}" data-tab="users"
            onclick="switchTab('users')">Users (${users.length})</button>
  </div>

  <div class="admin-panel${activeTab==='posts'?' active':''}" id="tab-posts">
    ${editor}
    <hr style="margin:28px 0 20px;">
    <h3>All Posts</h3>
    <table>
      <tr><th>Date</th><th>Title</th><th>Author</th><th>Published</th><th>Actions</th></tr>
      ${postRows}
    </table>
  </div>

  <div class="admin-panel${activeTab==='users'?' active':''}" id="tab-users">
    <h3>Registered Users</h3>
    <p style="color:#aaa;font-size:13px;margin-bottom:12px;">Reader accounts used for commenting.</p>
    <table>
      <tr><th>ID</th><th>Nickname</th><th>Email</th><th>Registered</th><th>Comments</th><th>Action</th></tr>
      ${userRows}
    </table>
  </div>
</div>

<script>
function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.admin-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
  history.replaceState(null, '', name === 'users' ? '/blog/admin/users' : '/blog/admin');
}
</script>`));
}

// ──────────────────────────────────────────────────────────────────────────────
// CATCH-ALL 404
// ──────────────────────────────────────────────────────────────────────────────

router.use((req, res) => {
  res.status(404).send(page('404 \u2014 NT:NH Blog', `
${topNav(req)}
<div class="content">
  <h1>404 &mdash; Not Found</h1>
  <p>This page doesn&apos;t exist.</p>
  <br>
  <a href="/blog" class="return">&lt; Back to blog</a>
</div>`));
});

module.exports = router;