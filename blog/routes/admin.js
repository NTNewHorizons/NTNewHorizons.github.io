'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES — admin login, dashboard (posts + users), post editor
// (Markdown toolbar, live preview, image uploads), delete post/user.
// ──────────────────────────────────────────────────────────────────────────────

const express = require('express');
const fs      = require('fs');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');

const router = express.Router();

const { readData, writeData } = require('../data');
const { escapeHtml, flashGet, flashSet, isAdmin, sortPosts, slugify, uniqueSlug } = require('../helpers');
const { page, topNav, flashHtml } = require('../render');
const { upload } = require('../uploads');

// ── Pages ─────────────────────────────────────────────────────────────────────

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

// ── Login / logout ────────────────────────────────────────────────────────────

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const admins = readData('admins.json');
  const admin  = admins.find(a => a.email === (email || '').trim().toLowerCase());
  if (!admin || !password) return renderAdminLogin(res, 'Invalid credentials.');
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return renderAdminLogin(res, 'Invalid credentials.');
  req.session.adminUser = { email: admin.email, displayName: admin.displayName };
  res.redirect('/blog/admin');
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/blog/admin'));
});

// ── Image upload endpoint ─────────────────────────────────────────────────────

// Verify the uploaded file's magic bytes match its extension. This catches
// disguised files (e.g. HTML/JS inside a .png) that slip past the extension filter.
function isRealImage(filepath) {
  let b;
  try { b = fs.readFileSync(filepath).subarray(0, 12); } catch { return false; }
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;                          // jpeg
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;          // png
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;          // gif
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&                     // webp
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

router.post('/admin/upload', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Not authorised' });

  if (!upload) {
    return res.status(503).json({ error: 'Image uploads unavailable. Run: npm install multer' });
  }

  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No valid image file received (jpg/png/gif/webp, max 8 MB)' });
    if (!isRealImage(req.file.path)) {
      fs.unlink(req.file.path, () => {}); // reject disguised files
      return res.status(400).json({ error: 'File content does not match an image type' });
    }
    res.json({ url: '/resources/blog-uploads/' + req.file.filename });
  });
});

// ── Save / delete post ────────────────────────────────────────────────────────

router.post('/admin/post', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const { id, action, title, slug: rawSlug, date, summary, imageUrl, content, published, pinned } = req.body || {};
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
  const isPinned    = pinned === 'on';
  const now         = new Date().toISOString();

  if (id) {
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) {
      const wasPinned   = !!posts[idx].pinned;
      const pinnedAt    = isPinned
        ? (wasPinned ? posts[idx].pinnedAt : now)  // keep original pin time if already pinned
        : null;

      posts[idx] = {
        ...posts[idx],
        title:       title.trim(),
        slug:        finalSlug,
        date:        date || posts[idx].date,
        summary:     (summary || '').trim(),
        imageUrl:    (imageUrl || '').trim(),
        content:     content || '',
        published:   published === 'on',
        pinned:      isPinned,
        pinnedAt,
        updatedAt:   now,
        updatedBy:   admin.displayName,
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
      date:          date || now.slice(0, 10),
      author:        admin.displayName,
      authorDisplay: admin.displayName,
      summary:       (summary || '').trim(),
      imageUrl:      (imageUrl || '').trim(),
      content:       content || '',
      published:     published === 'on',
      pinned:        isPinned,
      pinnedAt:      isPinned ? now : null,
      createdAt:     now,
    });
  }

  writeData('posts.json', posts);
  res.redirect('/blog/admin');
});

// ── Delete user ───────────────────────────────────────────────────────────────

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
  res.send(page('Blog Admin - NT:NH', `
<div class="login-box">
  <h2 style="margin-bottom:16px;font-variant:small-caps;">Admin Login</h2>
  ${error ? `<div class="msg error">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/blog/admin/login">
    <p>Email:<br>
    <input class="admin-input" style="width:100%;margin-top:4px;" type="email"
           name="email" autocomplete="email" required placeholder="admin@example.com" /></p>
    <p>Password:<br>
    <input class="admin-input" style="width:100%;margin-top:4px;" type="password"
           name="password" autocomplete="current-password" required /></p>
    <button class="admin-btn" type="submit" style="width:100%;margin-top:8px;">[ LOGIN ]</button>
  </form>
  <br>
  <p style="font-size:12px;color:#888;text-align:center;">You can also log in via <a href="/blog/login">/blog/login</a></p>
  <br><a href="/blog">&lt; Back to blog</a>
</div>`));
}

function renderAdminDashboard(req, res, editPost, activeTab) {
  const admin  = req.session.adminUser;
  const posts  = sortPosts(readData('posts.json'));
  const users  = readData('users.json');
  const flash  = flashGet(req);
  const today  = new Date().toISOString().slice(0, 10);

  // ── Post rows ──
  const postRows = posts.length
    ? posts.map(p => `
<tr${p.pinned ? ' style="background:rgba(255,204,0,0.04);"' : ''}>
  <td>${p.pinned ? '&#128204; ' : ''}${escapeHtml(p.date)}</td>
  <td>${p.published
    ? `<a href="/blog/post/${escapeHtml(p.slug)}" target="_blank">${escapeHtml(p.title)}</a>`
    : `<span style="color:#888;">${escapeHtml(p.title)} [draft]</span>`}</td>
  <td>${escapeHtml(p.authorDisplay || p.author)}</td>
  <td>${p.published ? '<span style="color:#4F4;">Yes</span>' : '<span style="color:#F88;">Draft</span>'}</td>
  <td>${p.pinned ? '<span style="color:#FF8;">&#128204; Pinned</span>' : '<span style="color:#888;">-</span>'}</td>
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
    : '<tr><td colspan="6" style="color:#aaa;">No posts yet.</td></tr>';

  // ── User rows ──
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
          onsubmit="return confirm('Delete user &quot;${escapeHtml(u.nickname).replace(/\\/g, "\\\\").replace(/'/g, "\\'")} &quot;?')">
      <input type="hidden" name="userId" value="${escapeHtml(u.id)}" />
      <button type="submit" class="admin-btn small danger">[Delete]</button>
    </form>
  </td>
</tr>`;
      }).join('\n')
    : '<tr><td colspan="6" style="color:#aaa;">No registered users yet.</td></tr>';

  // ── Editor ──
  const ep    = editPost || {};
  const isNew = !ep.id;
  const uploadAvailable = !!upload;

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
      <td>Cover Image</td>
      <td>
        <div class="cover-row">
          <input class="admin-input" type="text" name="imageUrl" id="imageUrlInput"
              value="${escapeHtml(ep.imageUrl || '')}"
              placeholder="https://... or /resources/screenshots/..."
              oninput="updateCoverPreview(this.value)" />
          ${uploadAvailable
            ? `<button type="button" class="admin-btn small" id="coverUploadBtn"
                  onclick="document.getElementById('coverFileInput').click()">&#128247; Upload</button>
               <input type="file" id="coverFileInput" accept="image/*" style="display:none">`
            : `<span style="color:#888;font-size:11px;">(install multer for upload)</span>`}
          <span class="upload-status" id="coverStatus"></span>
        </div>
        <img id="coverPreview" src="${escapeHtml(ep.imageUrl || '')}"
             class="cover-preview${ep.imageUrl ? ' show' : ''}"
             style="margin-top:6px;" alt="Cover preview">
      </td>
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
          &nbsp;Published (unchecked = draft)</label></td>
    </tr>
    <tr>
      <td>Pin</td>
      <td>
        <div class="pin-row">
          <label class="pin-label">
            <input type="checkbox" name="pinned" id="pinnedCheck" ${ep.pinned ? 'checked' : ''} />
            <span class="pin-icon">&#128204;</span>
            <span>Pin this post to the top of the blog</span>
          </label>
          ${ep.pinned && ep.pinnedAt ? `<span style="color:#888;font-size:11px;">Pinned ${new Date(ep.pinnedAt).toLocaleDateString('en-GB')}</span>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <br>
  <b>Content (Markdown):</b>

  <!-- ── Toolbar ── -->
  <div class="md-toolbar" id="mdToolbar">
    <div class="md-group">
      <button type="button" class="md-btn" title="Bold (Ctrl+B)" onclick="mdFmt('bold')"><b>B</b></button>
      <button type="button" class="md-btn" title="Italic (Ctrl+I)" onclick="mdFmt('italic')"><i>I</i></button>
      <button type="button" class="md-btn" title="Strikethrough" onclick="mdFmt('strike')">~~S~~</button>
    </div>
    <div class="md-toolbar-sep"></div>
    <div class="md-group">
      <button type="button" class="md-btn" title="Heading 1" onclick="mdFmt('h1')">H1</button>
      <button type="button" class="md-btn" title="Heading 2" onclick="mdFmt('h2')">H2</button>
      <button type="button" class="md-btn" title="Heading 3" onclick="mdFmt('h3')">H3</button>
    </div>
    <div class="md-toolbar-sep"></div>
    <div class="md-group">
      <button type="button" class="md-btn" title="Bullet list" onclick="mdFmt('ul')">&bull; List</button>
      <button type="button" class="md-btn" title="Numbered list" onclick="mdFmt('ol')">1. List</button>
      <button type="button" class="md-btn" title="Blockquote" onclick="mdFmt('quote')">&ldquo; Quote</button>
      <button type="button" class="md-btn" title="Horizontal rule" onclick="mdFmt('hr')">- HR</button>
    </div>
    <div class="md-toolbar-sep"></div>
    <div class="md-group">
      <button type="button" class="md-btn" title="Hyperlink" onclick="mdFmt('link')">&#128279; Link</button>
      <button type="button" class="md-btn" title="Insert image URL" onclick="mdFmt('imgurl')">&#128247; URL</button>
      <button type="button" class="md-btn" title="Inline code" onclick="mdFmt('code')">&grave;code&grave;</button>
      <button type="button" class="md-btn" title="Code block" onclick="mdFmt('codeblock')">&#9998; Block</button>
      <button type="button" class="md-btn" title="Table" onclick="mdFmt('table')">&#9776; Table</button>
    </div>
    ${uploadAvailable ? `
    <div class="md-toolbar-sep"></div>
    <div class="md-group">
      <button type="button" class="md-btn upload-btn" id="mdImgUploadBtn"
              title="Upload image and insert into post"
              onclick="document.getElementById('mdImgFileInput').click()">
        &#128228; Upload Img
      </button>
      <input type="file" id="mdImgFileInput" accept="image/*" style="display:none">
    </div>` : `
    <div class="md-toolbar-sep"></div>
    <div class="md-group">
      <span style="color:#666;font-size:11px;padding:0 6px;">run npm install multer for image upload</span>
    </div>`}
  </div>

  <!-- ── Editor + Preview ── -->
  <div class="preview-wrap md-editor-wrap" style="margin-top:0;">
    <div>
      <div style="color:#aaa;font-size:12px;margin-bottom:4px;">Editor</div>
      <textarea name="content" id="mdEditor" rows="26"
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
// ── Slug auto-gen ──
${isNew ? `
document.getElementById('titleInput').addEventListener('input', function() {
  var s = document.getElementById('slugInput');
  if (!s._edited) s.value = this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
});
document.getElementById('slugInput').addEventListener('input', function() { this._edited = true; });
` : ''}

// ── Load marked for preview ──
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

// ── Cover image preview ──
function updateCoverPreview(url) {
  var img = document.getElementById('coverPreview');
  if (url && url.trim()) {
    img.src = url.trim();
    img.classList.add('show');
  } else {
    img.classList.remove('show');
    img.src = '';
  }
}

// ── Cover upload ──
var coverFileInput = document.getElementById('coverFileInput');
if (coverFileInput) {
  coverFileInput.addEventListener('change', async function() {
    if (!this.files[0]) return;
    var btn    = document.getElementById('coverUploadBtn');
    var status = document.getElementById('coverStatus');
    btn.disabled = true;
    status.textContent = 'Uploading...';

    var fd = new FormData();
    fd.append('image', this.files[0]);
    try {
      var res  = await fetch('/blog/admin/upload', { method: 'POST', body: fd });
      var data = await res.json();
      if (data.url) {
        document.getElementById('imageUrlInput').value = data.url;
        updateCoverPreview(data.url);
        status.textContent = 'Uploaded!';
        setTimeout(function(){ status.textContent = ''; }, 2500);
      } else {
        status.textContent = 'Error: ' + (data.error || 'Upload failed');
      }
    } catch(e) {
      status.textContent = 'Error: ' + e.message;
    }
    btn.disabled = false;
    this.value = '';
  });
}

// ── Inline image upload ──
var mdImgInput = document.getElementById('mdImgFileInput');
if (mdImgInput) {
  mdImgInput.addEventListener('change', async function() {
    if (!this.files[0]) return;
    var btn = document.getElementById('mdImgUploadBtn');
    btn.textContent = '⏳ Uploading...';
    btn.disabled = true;

    var fd = new FormData();
    fd.append('image', this.files[0]);
    try {
      var res  = await fetch('/blog/admin/upload', { method: 'POST', body: fd });
      var data = await res.json();
      if (data.url) {
        mdInsert('\\n![image](' + data.url + ')\\n', 0);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch(e) {
      alert('Upload error: ' + e.message);
    }
    btn.textContent = '\\u{1F4E4} Upload Img';
    btn.disabled = false;
    this.value = '';
  });
}

// ── Keyboard shortcuts ──
document.getElementById('mdEditor').addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (e.key === 'b') { e.preventDefault(); mdFmt('bold'); }
    if (e.key === 'i') { e.preventDefault(); mdFmt('italic'); }
    if (e.key === 'k') { e.preventDefault(); mdFmt('link');  }
  }
});

// ── Core formatting function ──
function mdInsert(text, cursorDelta) {
  var ta    = document.getElementById('mdEditor');
  var start = ta.selectionStart;
  var end   = ta.selectionEnd;
  var before = ta.value.substring(0, start);
  var after  = ta.value.substring(end);
  ta.value   = before + text + after;
  var pos    = start + text.length + (cursorDelta || 0);
  ta.selectionStart = ta.selectionEnd = pos;
  ta.focus();
  updatePreview();
}

function mdWrap(before, after, placeholder) {
  var ta    = document.getElementById('mdEditor');
  var start = ta.selectionStart;
  var end   = ta.selectionEnd;
  var sel   = ta.value.substring(start, end) || placeholder;
  var text  = before + sel + after;
  var bText = ta.value.substring(0, start);
  var aText = ta.value.substring(end);
  ta.value  = bText + text + aText;
  // Select the inserted content (excluding wrappers) so user can immediately retype
  ta.selectionStart = start + before.length;
  ta.selectionEnd   = start + before.length + sel.length;
  ta.focus();
  updatePreview();
}

function mdFmt(action) {
  var ta  = document.getElementById('mdEditor');
  var sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);

  switch (action) {
    case 'bold':      mdWrap('**', '**', 'bold text'); break;
    case 'italic':    mdWrap('_', '_',   'italic text'); break;
    case 'strike':    mdWrap('~~', '~~', 'strikethrough'); break;
    case 'code':      { var bt = String.fromCharCode(96); mdWrap(bt, bt, 'code'); break; }
    case 'h1':        mdInsert('\\n# '   + (sel || 'Heading 1') + '\\n', 0); break;
    case 'h2':        mdInsert('\\n## '  + (sel || 'Heading 2') + '\\n', 0); break;
    case 'h3':        mdInsert('\\n### ' + (sel || 'Heading 3') + '\\n', 0); break;
    case 'ul':        mdInsert('\\n- '   + (sel || 'List item') + '\\n', 0); break;
    case 'ol':        mdInsert('\\n1. '  + (sel || 'List item') + '\\n', 0); break;
    case 'quote':     mdInsert('\\n> '   + (sel || 'Quoted text') + '\\n', 0); break;
    case 'hr':        mdInsert('\\n\\n---\\n\\n', 0); break;
    case 'codeblock': mdInsert('\\n\`\`\`\\n' + (sel || 'code here') + '\\n\`\`\`\\n', 0); break;
    case 'table':
      mdInsert('\\n| Column 1 | Column 2 | Column 3 |\\n|----------|----------|----------|\\n| Cell     | Cell     | Cell     |\\n', 0);
      break;
    case 'link': {
      var url = prompt('URL:', 'https://');
      if (!url) return;
      mdInsert('[' + (sel || 'link text') + '](' + url + ')', 0);
      break;
    }
    case 'imgurl': {
      var iurl = prompt('Image URL:', 'https://');
      if (!iurl) return;
      mdInsert('\\n![' + (sel || 'alt text') + '](' + iurl + ')\\n', 0);
      break;
    }
  }
}
</script>`;

  // ── Full page ──
  res.send(page('Blog Admin - NT:NH', `
${topNav(req)}
<div class="admin-wrap">
  <h2 style="margin-bottom:4px;">Blog Admin Panel</h2>
  <p style="font-size:13px;color:#aaa;margin-bottom:16px;">
    Logged in as <b style="color:#4F4;">${escapeHtml(admin.displayName)}</b>
    &nbsp;-&nbsp;
    <form method="POST" action="/blog/admin/logout" style="display:inline;">
      <button type="submit" class="admin-btn small danger">[Logout]</button>
    </form>
    &nbsp;-&nbsp;
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
      <tr><th>Date</th><th>Title</th><th>Author</th><th>Published</th><th>Pinned</th><th>Actions</th></tr>
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

module.exports = router;
