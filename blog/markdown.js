'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// MARKDOWN — single place where the `marked` parser is configured.
// (The admin editor's live preview uses the CDN copy of marked client-side.)
// ──────────────────────────────────────────────────────────────────────────────

const { marked } = require('marked');

marked.use({ gfm: true, breaks: true });

module.exports = { marked };
