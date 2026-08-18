'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// DATA LAYER — JSON flat-file storage for the blog.
// Files live in blog-data/ (blocked from static access in server.js).
// ──────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'blog-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = {
  'admins.json':   [],
  'posts.json':    [],
  'users.json':    [],
  'comments.json': {},
};

for (const [file, dflt] of Object.entries(DEFAULTS)) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(dflt, null, 2));
}

function readData(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    if (file === 'users.json' && !Array.isArray(raw)) return [];
    return raw;
  } catch {
    return DEFAULTS[file] ?? null;
  }
}

function writeData(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

module.exports = { DATA_DIR, readData, writeData };
