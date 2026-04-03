'use strict';

const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const { marked } = require('marked');
const crypto   = require('crypto');

// ──────────────────────────────────────────────────────────
// DATA LAYER
// ──────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '..', 'blog-data');

// Ensure data directory + default files exist on startup
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = {
  'admins.json':   [],
  'posts.json':    [],
  'users.json':    {},
  'comments.json': {}
};

for (const [file, val] of Object.entries(DEFAULTS)) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(val, null, 2));
}

function readData(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return DEFAULTS[file] ?? null;
  }
}

function writeData(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────

// Get real IP (the nginx config forwards X-Real-IP)
function getIP(req) {
  return (
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(desired, existingPosts, excludeId) {
  const others = existingPosts.filter(p => p.id !== excludeId).map(p => p.slug);
  let slug = desired;
  let n = 2;
  while (others.includes(slug)) { slug = `${desired}-${n++}`; }
  return slug;
}

function isAdmin(req) {
  return !!(req.session && req.session.adminUser);
}

function getUserNick(req) {
  const ip    = getIP(req);
  const users = readData('users.json');
  return users[ip]?.nickname || 'Anonymous';
}

function flashGet(req) {
  const msg = req.session?.flash ?? null;
  if (req.session) delete req.session.flash;
  return msg;
}

function flashSet(req, msg) {
  if (req.session) req.session.flash = msg;
}

// ──────────────────────────────────────────────────────────
// MARKDOWN SETUP
// ──────────────────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

// ──────────────────────────────────────────────────────────
// SHARED CSS  (matches the reference style exactly)
// ──────────────────────────────────────────────────────────

const BLOG_CSS = `
body{color:#FFF;background-color:#000;font-family:monospace;font-size:15px;margin:0;}
h1{border-style:outset;border-color:#000;}
h3{font-variant:small-caps;}
a{color:#FF8;text-decoration:none;}
a:hover{color:#FF8;text-decoration:underline;}
.return{padding:5px;border-style:outset;border-color:#FF8;background-color:#444;}
.cookies{margin:auto;width:98%;background-color:#777;border-style:outset;border-color:#aaa;text-align:center;padding-top:10px;padding-bottom:10px;}
.content{width:1000px;margin:auto;margin-top:60px;padding:20px;background-color:#777;border-style:outset;border-color:#aaa;}
.blog-panel{width:900px;height:206px;margin:auto;margin-top:20px;color:#FFF;background-color:#444;border-style:inset;border-color:#aaa;overflow:hidden;}
.blog-image{width:200px;height:200px;float:left;border-style:outset;border-color:#aaa;object-fit:cover;display:block;}
.blog-image-placeholder{width:200px;height:200px;float:left;border-style:outset;border-color:#aaa;background:#222;display:flex;align-items:center;justify-content:center;color:#555;font-size:40px;}
.blog-desc{width:648px;height:180px;padding:20px;padding-top:0;float:right;border-style:outset;border-color:#aaa;overflow:hidden;}
.blog-entry{padding:40px;padding-top:10px;background-color:#444;margin:auto;border-style:inset;border-color:#aaa;}
.blog-entry-image{display:block;margin:auto;border-style:inset;border-color:#aaa;max-width:100%;}
/* markdown content */
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
.comment{border-bottom:1px solid #555;padding:10px 0;}
.comment:last-of-type{border-bottom:none;}
.comment-nick{color:#FF8;font-weight:bold;}
.comment-date{color:#aaa;font-size:12px;margin-left:10px;}
.comment-text{margin-top:5px;white-space:pre-wrap;word-break:break-word;}
.comment-form{margin-top:20px;}
.comment-form input[type=text],.comment-form textarea{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:14px;padding:6px;width:100%;box-sizing:border-box;margin-bottom:8px;}
.comment-form button{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;padding:6px 16px;cursor:pointer;}
.nick-form{display:inline-flex;align-items:center;gap:4px;}
.nick-form input{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:13px;padding:3px 6px;width:160px;}
.nick-form button{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;padding:3px 8px;cursor:pointer;font-size:12px;}
.msg{padding:8px 12px;margin:10px 0;background:#333;border-left:3px solid #FF8;}
.msg.error{border-color:#F44;color:#F88;}
.msg.ok{border-color:#4F4;color:#8F8;}
/* admin */
.admin-wrap{width:1100px;margin:40px auto;background:#333;border-style:outset;border-color:#aaa;padding:30px;box-sizing:border-box;}
.admin-wrap table{border-collapse:collapse;width:100%;margin-bottom:16px;}
.admin-wrap th,.admin-wrap td{border:1px solid #555;padding:6px 10px;text-align:left;vertical-align:top;}
.admin-wrap th{background:#222;color:#FF8;}
.admin-input{background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:13px;padding:4px 6px;box-sizing:border-box;}
.admin-btn{background:#444;color:#FF8;border-style:outset;border-color:#FF8;font-family:monospace;padding:6px 16px;cursor:pointer;}
.admin-btn.danger{color:#F88;border-color:#F44;}
.admin-btn.small{padding:2px 8px;font-size:12px;}
.login-box{width:380px;margin:120px auto;background:#333;border-style:outset;border-color:#aaa;padding:30px;}
.preview-wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.preview-pane{background:#444;padding:16px;overflow-y:auto;max-height:400px;border-style:inset;border-color:#aaa;}
@media(max-width:1120px){.content,.blog-panel,.admin-wrap{width:98%;}}
@media(max-width:960px){.blog-panel{height:auto;}.blog-image,.blog-image-placeholder{float:none;width:100%;height:140px;}.blog-desc{float:none;width:100%;height:auto;}}
`;

// ──────────────────────────────────────────────────────────
// PAGE TEMPLATES
// ──────────────────────────────────────────────────────────

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

function blogImageEl(imageUrl) {
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" class="blog-image" alt="" loading="lazy" />`;
  }
  return `<div class="blog-image-placeholder">☢</div>`;
}

// ──────────────────────────────────────────────────────────
// ROUTES — PUBLIC BLOG
// ──────────────────────────────────────────────────────────

// GET /blog  — listing
router.get('/', (req, res) => {
  const posts = readData('posts.json')
    .filter(p => p.published)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const nick  = getUserNick(req);
  const flash = flashGet(req);

  const panels = posts.map(p => `
<div class="blog-panel">
  ${blogImageEl(p.imageUrl)}
  <div class="blog-desc">
    <h3><a href="/blog/post/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h3>
    ${escapeHtml(p.date)} <hr>
    ${escapeHtml(p.summary || '')}
  </div>
</div>`).join('\n');

  res.send(page('NT:NH Dev Blog', `
<div class="cookies">
  This site uses cookies. Click <a href="https://en.wikipedia.org/wiki/Cookie">here</a> to accept and <a href="https://en.wikipedia.org/wiki/Diabetes">here</a> to decline.
</div>
<div class="content">
  <h1 style="text-align:center;">NT:NH Dev Blog</h1>
  The official development blog for Nuclear Tech: New Horizons.<br><br>
  Your nickname: <b>${escapeHtml(nick)}</b> &mdash;
  <form class="nick-form" action="/blog/user/nickname" method="POST">
    <input type="hidden" name="redirect" value="/blog" />
    <input type="text" name="nickname" maxlength="30" placeholder="new nickname" />
    <button type="submit">Set</button>
  </form>
  <br><br>
  ${flash ? `<div class="msg${flash.startsWith('Error') ? ' error' : ' ok'}">${escapeHtml(flash)}</div>` : ''}
  <a href="/" class="return">&lt; Back to main site</a>
  <br><hr><br>
  ${panels || '<p>No posts yet.</p>'}
</div>`));
});

// GET /blog/post/:slug — single post
router.get('/post/:slug', (req, res) => {
  const posts = readData('posts.json');
  const post  = posts.find(p => p.slug === req.params.slug && p.published);
  if (!post) return res.status(404).send(page('Not Found', `
<div class="content"><h1>404</h1><p>Post not found.</p><a href="/blog" class="return">&lt; Back to blog</a></div>`));

  const nick     = getUserNick(req);
  const flash    = flashGet(req);
  const allComs  = readData('comments.json');
  const comments = allComs[req.params.slug] || [];

  const commentsHtml = comments.length
    ? comments.map(c => `
<div class="comment">
  <span class="comment-nick">${escapeHtml(c.nickname)}</span>
  <span class="comment-date">${new Date(c.date).toLocaleString('en-GB')}</span>
  <div class="comment-text">${escapeHtml(c.content)}</div>
</div>`).join('\n')
    : '<p style="color:#aaa;">No comments yet. Be the first!</p>';

  const rendered = marked(post.content || '');

  res.send(page(`${post.title} — NT:NH Blog`, `
<div class="content">
  <h1 style="text-align:center;">${escapeHtml(post.title)}</h1>
  <div class="blog-entry">
    <h3>${escapeHtml(post.authorDisplay || post.author)} &mdash; ${escapeHtml(post.date)}</h3>
    ${rendered}
  </div>
  <div class="comments" id="comments">
    <h3>Comments (${comments.length})</h3>
    ${flash ? `<div class="msg${flash.startsWith('Error') ? ' error' : ' ok'}">${escapeHtml(flash)}</div>` : ''}
    ${commentsHtml}
    <div class="comment-form">
      <hr>
      <p>Commenting as: <b>${escapeHtml(nick)}</b> &mdash;
        <form class="nick-form" action="/blog/user/nickname" method="POST">
          <input type="hidden" name="redirect" value="/blog/post/${escapeHtml(post.slug)}#comments" />
          <input type="text" name="nickname" maxlength="30" placeholder="new nickname" />
          <button type="submit">Set</button>
        </form>
      </p>
      <form action="/blog/post/${escapeHtml(post.slug)}/comment" method="POST">
        <textarea name="content" rows="5" maxlength="2000" placeholder="Write a comment... (max 2000 chars)"></textarea>
        <button type="submit">Post Comment</button>
      </form>
    </div>
  </div>
  <br>
  <a class="return" href="/blog">&lt; Back to blog</a>
</div>`));
});

// POST /blog/post/:slug/comment — add comment
router.post('/post/:slug/comment', (req, res) => {
  const slug  = req.params.slug;
  const posts = readData('posts.json');
  if (!posts.find(p => p.slug === slug && p.published))
    return res.status(404).send('Post not found');

  const content = (req.body.content || '').trim();
  if (!content || content.length > 2000) {
    flashSet(req, 'Error: Comment must be between 1 and 2000 characters.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const ip   = getIP(req);
  const nick = getUserNick(req);
  const all  = readData('comments.json');
  if (!all[slug]) all[slug] = [];

  all[slug].push({ ip, nickname: nick, content, date: new Date().toISOString() });
  writeData('comments.json', all);

  flashSet(req, 'Comment posted!');
  res.redirect(`/blog/post/${slug}#comments`);
});

// ──────────────────────────────────────────────────────────
// ROUTES — USER PROFILE (nickname)
// ──────────────────────────────────────────────────────────

router.post('/user/nickname', (req, res) => {
  const redirect  = req.body.redirect || '/blog';
  const nickname  = (req.body.nickname || '').trim();

  if (!nickname || nickname.length < 1 || nickname.length > 30) {
    flashSet(req, 'Error: Nickname must be 1–30 characters.');
    return res.redirect(redirect);
  }

  // Block admin usernames and display names
  const admins     = readData('admins.json');
  const adminNames = admins.flatMap(a =>
    [a.username, a.displayName || ''].map(n => n.toLowerCase()).filter(Boolean)
  );
  if (adminNames.includes(nickname.toLowerCase())) {
    flashSet(req, 'Error: That nickname is reserved.');
    return res.redirect(redirect);
  }

  // Block nicknames already claimed by a different IP
  const ip    = getIP(req);
  const users = readData('users.json');
  for (const [userIp, user] of Object.entries(users)) {
    if (userIp !== ip && (user.nickname || '').toLowerCase() === nickname.toLowerCase()) {
      flashSet(req, 'Error: That nickname is already taken by someone else.');
      return res.redirect(redirect);
    }
  }

  if (!users[ip]) users[ip] = { joinedAt: new Date().toISOString() };
  users[ip].nickname = nickname;
  writeData('users.json', users);

  flashSet(req, `Nickname set to "${nickname}".`);
  res.redirect(redirect);
});

// ──────────────────────────────────────────────────────────
// ROUTES — ADMIN
// ──────────────────────────────────────────────────────────

// GET /blog/admin
router.get('/admin', (req, res) => {
  if (!isAdmin(req)) return renderLoginPage(res);
  renderAdminDashboard(req, res, null);
});

// GET /blog/admin/edit/:id
router.get('/admin/edit/:id', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/blog/admin');
  const posts = readData('posts.json');
  const post  = posts.find(p => p.id === req.params.id);
  if (!post) { flashSet(req, 'Error: Post not found.'); return res.redirect('/blog/admin'); }
  renderAdminDashboard(req, res, post);
});

// POST /blog/admin/login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admins = readData('admins.json');
  const admin  = admins.find(a => a.username === username);

  if (!admin || !password) return renderLoginPage(res, 'Invalid credentials.');

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return renderLoginPage(res, 'Invalid credentials.');

  req.session.adminUser = {
    username:    admin.username,
    displayName: admin.displayName || admin.username
  };
  res.redirect('/blog/admin');
});

// POST /blog/admin/logout
router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/blog/admin'));
});

// POST /blog/admin/post  — create / update / delete
router.post('/admin/post', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const { id, action, title, slug: rawSlug, date, summary, imageUrl, content, published } = req.body || {};
  const posts = readData('posts.json');

  // Delete
  if (action === 'delete' && id) {
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) {
      posts.splice(idx, 1);
      writeData('posts.json', posts);
    }
    return res.redirect('/blog/admin');
  }

  // Validate
  if (!title || !title.trim()) {
    flashSet(req, 'Error: Title is required.');
    return res.redirect(id ? `/blog/admin/edit/${id}` : '/blog/admin');
  }

  const desiredSlug = rawSlug?.trim() || slugify(title.trim());
  const finalSlug   = uniqueSlug(desiredSlug, posts, id || null);
  const admin       = req.session.adminUser;

  if (id) {
    // Update existing
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
    // Create new
    posts.unshift({
      id:           crypto.randomBytes(8).toString('hex'),
      slug:         finalSlug,
      title:        title.trim(),
      date:         date || new Date().toISOString().slice(0, 10),
      author:       admin.username,
      authorDisplay: admin.displayName,
      summary:      (summary || '').trim(),
      imageUrl:     (imageUrl || '').trim(),
      content:      content || '',
      published:    published === 'on',
      createdAt:    new Date().toISOString(),
    });
  }

  writeData('posts.json', posts);
  res.redirect('/blog/admin');
});

// ──────────────────────────────────────────────────────────
// ADMIN PAGE RENDERERS
// ──────────────────────────────────────────────────────────

function renderLoginPage(res, error = '') {
  res.send(page('Blog Admin Login', `
<div class="login-box">
  <h3>Blog Admin Login</h3>
  ${error ? `<div class="msg error">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/blog/admin/login">
    <p>Username:<br>
    <input class="admin-input" style="width:100%;" type="text" name="username" autocomplete="username" required /></p>
    <p>Password:<br>
    <input class="admin-input" style="width:100%;" type="password" name="password" autocomplete="current-password" required /></p>
    <button class="admin-btn" type="submit" style="width:100%;">[ LOGIN ]</button>
  </form>
  <br>
  <a href="/blog">&lt; Back to blog</a>
</div>`));
}

function renderAdminDashboard(req, res, editPost) {
  const admin = req.session.adminUser;
  const posts = readData('posts.json').sort((a, b) => new Date(b.date) - new Date(a.date));
  const flash = flashGet(req);

  // ── Post list table ──
  const postRows = posts.length
    ? posts.map(p => `
<tr>
  <td>${escapeHtml(p.date)}</td>
  <td>${p.published
    ? `<a href="/blog/post/${escapeHtml(p.slug)}" target="_blank">${escapeHtml(p.title)}</a>`
    : `<span style="color:#aaa;">${escapeHtml(p.title)}</span> <span style="color:#888;">[draft]</span>`
  }</td>
  <td>${escapeHtml(p.authorDisplay || p.author)}</td>
  <td>${p.published ? '<span style="color:#8F8;">Yes</span>' : '<span style="color:#F88;">Draft</span>'}</td>
  <td>
    <a href="/blog/admin/edit/${escapeHtml(p.id)}" class="admin-btn small">[Edit]</a>
    &nbsp;
    <form method="POST" action="/blog/admin/post" style="display:inline;" onsubmit="return confirm('Delete post: ${escapeHtml(p.title).replace(/'/g, "\\'")}?')">
      <input type="hidden" name="id" value="${escapeHtml(p.id)}" />
      <input type="hidden" name="action" value="delete" />
      <button type="submit" class="admin-btn small danger">[Delete]</button>
    </form>
  </td>
</tr>`).join('\n')
    : '<tr><td colspan="5" style="color:#aaa;">No posts yet.</td></tr>';

  // ── Editor (create or edit) ──
  const ep    = editPost || {};
  const isNew = !ep.id;
  const today = new Date().toISOString().slice(0, 10);

  const editorSection = `
<h3 style="margin-top:30px;">${isNew ? 'Create New Post' : `Editing: ${escapeHtml(ep.title || '')}`}</h3>
<form method="POST" action="/blog/admin/post" id="postForm">
  ${ep.id ? `<input type="hidden" name="id" value="${escapeHtml(ep.id)}" />` : ''}
  <table>
    <tr>
      <td style="width:120px;">Title *</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="title"
          value="${escapeHtml(ep.title || '')}" required id="titleInput" /></td>
    </tr>
    <tr>
      <td>Slug</td>
      <td><input class="admin-input" style="width:100%;" type="text" name="slug"
          value="${escapeHtml(ep.slug || '')}" id="slugInput"
          placeholder="auto-generated from title if left empty" /></td>
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
          value="${escapeHtml(ep.summary || '')}" maxlength="300" /></td>
    </tr>
    <tr>
      <td>Published</td>
      <td><label><input type="checkbox" name="published" ${ep.published ? 'checked' : ''} />
          &nbsp;Check to publish (unchecked = draft, not visible on blog)</label></td>
    </tr>
  </table>
  <br>
  <b>Content (full Markdown supported):</b><br>
  <div class="preview-wrap">
    <div>
      <div style="color:#aaa;font-size:12px;margin-bottom:4px;">Editor</div>
      <textarea name="content" id="mdEditor" rows="22"
        style="width:100%;background:#222;color:#FFF;border:1px solid #aaa;font-family:monospace;font-size:13px;padding:8px;box-sizing:border-box;resize:vertical;"
        oninput="updatePreview()">${escapeHtml(ep.content || '')}</textarea>
    </div>
    <div>
      <div style="color:#aaa;font-size:12px;margin-bottom:4px;">Preview</div>
      <div class="preview-pane blog-entry" id="mdPreview"></div>
    </div>
  </div>
  <br>
  <button class="admin-btn" type="submit">[ ${isNew ? 'PUBLISH / SAVE DRAFT' : 'SAVE CHANGES'} ]</button>
  &nbsp;&nbsp;
  ${!isNew ? '<a href="/blog/admin">[Cancel &amp; back]</a>' : ''}
</form>

<script>
// Auto-generate slug from title for new posts
${isNew ? `
document.getElementById('titleInput').addEventListener('input', function() {
  var s = document.getElementById('slugInput');
  if (!s._edited) {
    s.value = this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  }
});
document.getElementById('slugInput').addEventListener('input', function() { this._edited = true; });
` : ''}

// Live preview using marked from CDN
var marked;
var script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/marked@9/marked.min.js';
script.onload = function() { updatePreview(); };
document.head.appendChild(script);

function updatePreview() {
  var src = document.getElementById('mdEditor').value;
  var preview = document.getElementById('mdPreview');
  if (window.marked && preview) {
    preview.innerHTML = window.marked.parse(src, {gfm:true,breaks:true});
  }
}
</script>`;

  res.send(page('Blog Admin — NT:NH', `
<div class="admin-wrap">
  <h1>Blog Admin Panel</h1>
  Logged in as: <b>${escapeHtml(admin.displayName || admin.username)}</b>
  &nbsp;&mdash;&nbsp;
  <form method="POST" action="/blog/admin/logout" style="display:inline;">
    <button type="submit" class="admin-btn small danger">[Logout]</button>
  </form>
  &nbsp;&mdash;&nbsp;
  <a href="/blog">View Blog</a>

  <hr>

  ${flash ? `<div class="msg${flash.startsWith('Error') ? ' error' : ' ok'}">${escapeHtml(flash)}</div>` : ''}

  ${editorSection}

  <hr>
  <h3>All Posts</h3>
  <table>
    <tr><th>Date</th><th>Title</th><th>Author</th><th>Published</th><th>Actions</th></tr>
    ${postRows}
  </table>
</div>`));
}

// ──────────────────────────────────────────────────────────
// CATCH-ALL — prevents static middleware from leaking blog/ files
// ──────────────────────────────────────────────────────────

router.use((req, res) => {
  res.status(404).send(page('404 — NT:NH Blog', `
<div class="content">
  <h1>404 — Not Found</h1>
  <p>This page doesn't exist.</p>
  <a href="/blog" class="return">&lt; Back to blog</a>
</div>`));
});

module.exports = router;
