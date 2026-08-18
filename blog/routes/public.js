'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — blog index, individual post pages, and comments.
// ──────────────────────────────────────────────────────────────────────────────

const express   = require('express');
const crypto    = require('crypto');

const router = express.Router();

const { readData, writeData }  = require('../data');
const { marked }               = require('../markdown');
const { escapeHtml, sortPosts, flashGet, flashSet, isUser, isAdmin, getCurrentUser } = require('../helpers');
const { page, topNav, blogImageEl, flashHtml } = require('../render');

// ── Blog index ────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const allPosts  = readData('posts.json').filter(p => p.published);
  const posts     = sortPosts(allPosts);
  const flash     = flashGet(req);
  const allComs   = readData('comments.json');

  const panels = posts.length
    ? posts.map(p => {
        const count    = (allComs[p.slug] || []).length;
        const pinBadge = p.pinned ? '<span class="pin-badge">&#128204; PINNED</span>' : '';
        return `
<div class="blog-panel${p.pinned ? ' is-pinned' : ''}">
  ${p.pinned ? '<span class="pin-corner">&#128204; PINNED</span>' : ''}
  ${blogImageEl(p.imageUrl)}
  <div class="blog-desc">
    <h3>${pinBadge}<a href="/blog/post/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h3>
    ${escapeHtml(p.date)} &middot; ${count} comment${count !== 1 ? 's' : ''}<hr>
    ${escapeHtml(p.summary || '')}
  </div>
</div>`;
      }).join('\n')
    : '<p style="margin-top:20px;color:#222;">No posts yet - check back soon.</p>';

  res.send(page('NT:NH Dev Blog', `
${topNav(req)}
<div class="content">
  <h1 style="text-align:center;">NT:NH Dev Blog</h1>
  <p>Devs talk shiiiiiiiiiiiiiiiiiiiiiiiiiiiiit</p>
  <p>Weekly dev sneakpeeks are being post here, but also some random stuff</p>
  ${flashHtml(flash)}
  ${panels}
</div>`));
});

// ── Single post + comments ────────────────────────────────────────────────────

router.get('/post/:slug', (req, res) => {
  const posts = readData('posts.json');
  const post  = posts.find(p => p.slug === req.params.slug && p.published);
  if (!post) return res.status(404).send(page('Not Found', `
${topNav(req)}
<div class="content"><h1>404</h1><p>Post not found.</p><br>
<a href="/blog" class="return">&lt; Back to blog</a></div>`));

  const user       = getCurrentUser(req);
  const admin      = req.session?.adminUser;
  const flash      = flashGet(req);
  const allComs    = readData('comments.json');
  const comments   = allComs[req.params.slug] || [];
  const commenterId = user ? user.id : admin ? `admin:${admin.email}` : null;

  const commentsHtml = comments.length
    ? comments.map(c => {
        const isOwn  = commenterId && commenterId === c.userId;
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

  const commentFormHtml = (user || admin)
    ? (() => {
        const commentActorLabel = admin
          ? `<b style="color:#4F4;">${escapeHtml(admin.displayName)}</b> - <a href="/blog/admin">Admin panel</a>`
          : `<b style="color:#4F4;">${escapeHtml(user.nickname)}</b> - <a href="/blog/profile">change nickname</a>`;
        return `<div class="comment-form" style="margin-top:20px;">
         <hr>
         <p>Commenting as ${commentActorLabel}</p>
         <form method="POST" action="/blog/post/${escapeHtml(post.slug)}/comment">
           <textarea name="content" rows="5" maxlength="2000"
             placeholder="Write a comment... (max 2000 characters)"></textarea>
           <button type="submit">Post Comment</button>
         </form>
       </div>`;
      })()
    : `<div class="comment-gate">
         <b>Want to join the discussion?</b><br>
         <a href="/blog/login">[Login]</a> &nbsp; or &nbsp;
         <a href="/blog/register">[Create a free account]</a> to leave a comment.
       </div>`;

  const pinBadge = post.pinned ? '<span class="pin-badge">&#128204; PINNED</span>' : '';

  res.send(page(`${post.title} - NT:NH Blog`, `
${topNav(req)}
<div class="content">
  <h1 style="text-align:center;">${pinBadge}${escapeHtml(post.title)}</h1>
  <div class="blog-entry">
    <h3>${escapeHtml(post.authorDisplay || post.author)} - ${escapeHtml(post.date)}</h3>
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

// ── Add comment ───────────────────────────────────────────────────────────────

router.post('/post/:slug/comment', (req, res) => {
  const slug  = req.params.slug;
  const admin = req.session?.adminUser;

  if (!isUser(req) && !isAdmin(req)) {
    flashSet(req, 'Error: You must be logged in to post a comment.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const user      = getCurrentUser(req);
  const commenter = user || (admin && {
    id:       `admin:${admin.email}`,
    nickname: admin.displayName,
  });

  if (!commenter) { req.session.destroy(); return res.redirect('/blog/login'); }

  const posts = readData('posts.json');
  if (!posts.find(p => p.slug === slug && p.published))
    return res.status(404).send('Post not found.');

  const content = ((req.body && req.body.content) || '').trim();
  if (!content || content.length > 2000) {
    flashSet(req, 'Error: Comment must be 1\u20132000 characters.');
    return res.redirect(`/blog/post/${slug}#comments`);
  }

  const all = readData('comments.json');
  if (!all[slug]) all[slug] = [];
  all[slug].push({
    id:       crypto.randomBytes(8).toString('hex'),
    userId:   commenter.id,
    nickname: commenter.nickname,
    content,
    date:     new Date().toISOString(),
  });
  writeData('comments.json', all);

  flashSet(req, 'Comment posted!');
  res.redirect(`/blog/post/${slug}#comments`);
});

// ── Delete comment ────────────────────────────────────────────────────────────

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

module.exports = router;
