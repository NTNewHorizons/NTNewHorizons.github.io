'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// BLOG ROUTER — thin assembly point. All route logic lives in routes/:
//   routes/public.js   → blog index, post pages, comments
//   routes/auth.js     → register, login, logout, email verification
//   routes/profile.js  → user profile, nickname, password
//   routes/admin.js    → admin panel, post editor, uploads
// Shared infrastructure: data.js (storage), helpers.js (utils),
// render.js (page shell + CSS), uploads.js (multer), markdown.js (marked).
// ──────────────────────────────────────────────────────────────────────────────

const express = require('express');

const router = express.Router();

const { page, topNav } = require('./render');

// Mount feature routers. The catch-all 404 below must stay LAST.
router.use(require('./routes/public'));
router.use(require('./routes/auth'));
router.use(require('./routes/profile'));
router.use(require('./routes/admin'));

// ── Catch-all 404 ─────────────────────────────────────────────────────────────

router.use((req, res) => {
  res.status(404).send(page('404 - NT:NH Blog', `
${topNav(req)}
<div class="content">
  <h1>404 - Not Found</h1>
  <p>This page doesn&apos;t exist.</p>
  <br>
  <a href="/blog" class="return">&lt; Back to blog</a>
</div>`));
});

module.exports = router;
