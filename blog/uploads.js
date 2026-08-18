'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOADS — multer middleware (optional dependency).
// If multer is not installed, `upload` is null and uploads are disabled.
// Files are stored in resources/blog-uploads/ (8 MB limit, image MIME only).
// ──────────────────────────────────────────────────────────────────────────────

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'resources', 'blog-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let upload = null;
try {
  const multer  = require('multer');
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      cb(null, Date.now() + '_' + crypto.randomBytes(6).toString('hex') + ext);
    },
  });
  upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    // NOTE: no SVG - SVG can carry <script> and executes same-origin (stored XSS).
    // File content is additionally validated against magic bytes in routes/admin.js.
    fileFilter: (_req, file, cb) =>
      cb(null, /\.(jpe?g|png|gif|webp)$/i.test(path.extname(file.originalname))),
  });
} catch {
  upload = null; // multer not installed; uploads disabled
}

module.exports = { UPLOAD_DIR, upload };
