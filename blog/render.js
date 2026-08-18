'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// RENDER — all blog HTML lives here: the full stylesheet (BLOG_CSS), the page
// shell (`page`), the top navigation bar (`topNav`), and small HTML fragments.
// ──────────────────────────────────────────────────────────────────────────────

const { escapeHtml, getCurrentUser } = require('./helpers');

const BLOG_CSS = `
*{box-sizing:border-box;}
body{color:#FFF;background-color:#000;font-family:monospace;font-size:15px;margin:0;}
h1{border-style:outset;border-color:#000;}
h3{font-variant:small-caps;}
a{color:#FF8;text-decoration:none;}
a:hover{color:#FF8;text-decoration:underline;}
.return{padding:5px;border-style:outset;border-color:#FF8;background-color:#444;}
.content{width:1000px;margin:auto;margin-top:40px;padding:20px;background-color:#777;border-style:outset;border-color:#aaa;}
.blog-panel{width:900px;height:206px;margin:auto;margin-top:20px;color:#FFF;background-color:#444;border-style:inset;border-color:#aaa;overflow:hidden;position:relative;}
.blog-panel.is-pinned{border-left:4px solid #FF8;box-shadow:inset 4px 0 12px rgba(255,204,0,0.08);}
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

/* pin badge */
.pin-badge{display:inline-flex;align-items:center;gap:4px;background:#FF8;color:#000;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:3px;vertical-align:middle;margin-right:6px;letter-spacing:0.05em;}
.pin-corner{position:absolute;top:6px;right:6px;background:#FF8;color:#000;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:3px;letter-spacing:0.05em;}

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

/* flash */
.msg{padding:8px 12px;margin:10px 0;background:#333;border-left:3px solid #FF8;}
.msg.error{border-color:#F44;color:#F88;}
.msg.ok,.msg.success{border-color:#4F4;color:#8F8;}
.msg.info{border-color:#88F;color:#aaf;}

/* top nav */
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

/* ── Markdown toolbar ── */
.md-toolbar{display:flex;flex-wrap:wrap;gap:3px;padding:7px 8px;background:#1a0800;border:1px solid #555;border-bottom:none;border-radius:5px 5px 0 0;align-items:center;}
.md-toolbar-sep{width:1px;background:#444;margin:0 4px;align-self:stretch;min-height:18px;}
.md-group{display:flex;gap:2px;flex-wrap:wrap;align-items:center;}
.md-btn{background:#2a1500;color:#FF8;border:1px solid #554400;font-family:monospace;font-size:12px;padding:3px 9px;cursor:pointer;border-radius:3px;white-space:nowrap;line-height:1.4;transition:background 0.1s,border-color 0.1s;}
.md-btn:hover{background:#3a2000;border-color:#FF8;}
.md-btn:active{background:#553300;}
.md-btn.upload-btn{color:#4F4;border-color:#244;}
.md-btn.upload-btn:hover{background:#1a3a1a;border-color:#4F4;}
.md-btn[disabled]{opacity:0.45;cursor:not-allowed;}
.md-editor-wrap textarea{border-radius:0 0 4px 4px!important;border-top:none!important;}

/* cover upload row */
.cover-row{display:flex;gap:6px;align-items:center;}
.cover-row .admin-input{flex:1;}
.cover-preview{max-height:48px;max-width:120px;border:1px solid #555;border-radius:3px;object-fit:cover;display:none;}
.cover-preview.show{display:block;}
.upload-status{font-size:11px;color:#aaa;margin-left:4px;}

/* pinned row */
.pin-row{display:flex;align-items:center;gap:10px;}
.pin-label{display:flex;align-items:center;gap:6px;cursor:pointer;}
.pin-icon{font-size:14px;}

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

// ── Page shell ───────────────────────────────────────────────────────────────

function page(title, body, ogMeta) {
  const ogTitle       = escapeHtml(ogMeta?.title       ?? title);
  const ogDescription = escapeHtml(ogMeta?.description ?? 'The official NT:NH blog - news, updates, and community spotlights.');
  const ogImage       = 'https://ntnewhorizons.com/resources/favicon.ico';
  const ogUrl         = 'https://ntnewhorizons.com/blog';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta property="og:site_name" content="Nuclear Tech: New Horizons">
<meta property="og:type" content="website">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${ogUrl}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDescription}">
<meta name="twitter:image" content="${ogImage}">
<style>${BLOG_CSS}</style>
</head>
<body>
${body}
<div style="margin-top:30px;padding:8px;text-align:center;font-size:12px;color:#888;border-top:1px solid #333;">
  This blog uses a session cookie for authentication (strictly necessary). No tracking cookies are used.
  <a href="/privacy-policy" style="color:#FF8;">Privacy Policy</a>
</div>
</body>
</html>`;
}

// ── Top navigation bar ───────────────────────────────────────────────────────

function topNav(req) {
  const user  = getCurrentUser(req);
  const admin = req.session?.adminUser;
  let right = '';
  if (admin) {
    right = `
      <span class="tnav-user">&#9733; ${escapeHtml(admin.displayName)}</span>
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
    right = `<a href="/blog/login">[Login]</a><a href="/blog/register">[Register]</a><a href="/blog/admin">[Admin Panel]</a>`;
  }
  return `<nav class="blog-topnav">
  <a href="/blog" class="tnav-brand">&#9762; NT:NH Blog</a>
  <a href="/">&larr; Main Site</a>
  <div class="tnav-right">${right}</div>
</nav>`;
}

// ── Small HTML fragments ─────────────────────────────────────────────────────

function blogImageEl(imageUrl) {
  if (imageUrl) return `<img src="${escapeHtml(imageUrl)}" class="blog-image" alt="" loading="lazy" />`;
  return `<div class="blog-image-placeholder">&#9762;</div>`;
}

function flashHtml(flash) {
  if (!flash) return '';
  const cls = flash.startsWith('Error') ? 'error' : flash.startsWith('Info') ? 'info' : 'ok';
  return `<div class="msg ${cls}">${escapeHtml(flash)}</div>`;
}

module.exports = { BLOG_CSS, page, topNav, blogImageEl, flashHtml };
