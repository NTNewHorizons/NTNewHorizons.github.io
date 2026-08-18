'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS — shared utilities: escaping, slugs, sessions, flash messages,
// validation, verification email, nickname cooldown, post sorting.
// ──────────────────────────────────────────────────────────────────────────────

const dns     = require('dns').promises;
const { readData } = require('./data');

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

// ── Session helpers ──────────────────────────────────────────────────────────

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

// ── Validation ───────────────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function hasEmailDomain(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return true; // fail open - DNS errors may be temporary
  }
}

function isValidNickname(nick) {
  return /^[a-zA-Z0-9_\- ]{1,30}$/.test(nick);
}

// ── Verification email (Resend) ──────────────────────────────────────────────

const RESEND_API_KEY     = () => process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL  = () => process.env.RESEND_FROM_EMAIL || 'noreply@ntnewhorizons.com';
const VERIFICATION_EXPIRY_HOURS = 48;

async function sendVerificationEmail(email, token) {
  const apiKey = RESEND_API_KEY();
  if (!apiKey) return false;
  const verifyUrl = `https://ntnewhorizons.com/blog/verify/${token}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL(),
        to: email,
        subject: 'Verify your email - NT:NH Blog',
        html: `<p>Thanks for registering on the Nuclear Tech: New Horizons blog!</p>
<p>Please verify your email by clicking the link below:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>This link expires in ${VERIFICATION_EXPIRY_HOURS} hours.</p>
<p>If you did not create an account, you can ignore this email.</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Nickname cooldown ────────────────────────────────────────────────────────

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
    .flatMap(a => [a.displayName || ''].map(n => n.toLowerCase()).filter(Boolean))
    .includes(low);
}

// ── Post ordering: pinned first (newest pin first), then by date desc ────────

function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.pinned && b.pinned) return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0);
    return new Date(b.date) - new Date(a.date);
  });
}

module.exports = {
  escapeHtml,
  slugify,
  uniqueSlug,
  isAdmin,
  isUser,
  getCurrentUser,
  flashGet,
  flashSet,
  isValidEmail,
  hasEmailDomain,
  isValidNickname,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  VERIFICATION_EXPIRY_HOURS,
  sendVerificationEmail,
  NICK_COOLDOWN_DAYS,
  daysSince,
  nickTimeRemaining,
  isReservedNick,
  sortPosts,
};
