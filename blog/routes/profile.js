'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// USER PROFILE ROUTES — profile page, nickname change, password change.
// ──────────────────────────────────────────────────────────────────────────────

const express = require('express');
const bcrypt  = require('bcryptjs');

const router = express.Router();

const { readData, writeData } = require('../data');
const {
  escapeHtml, flashGet, flashSet, isUser, getCurrentUser,
  isValidNickname, isReservedNick,
  NICK_COOLDOWN_DAYS, daysSince, nickTimeRemaining,
} = require('../helpers');
const { page, topNav, flashHtml } = require('../render');

// ── Profile page ──────────────────────────────────────────────────────────────

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

  res.send(page('Your Profile - NT:NH Blog', `
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

// ── Change nickname ───────────────────────────────────────────────────────────

router.post('/profile/nickname', (req, res) => {
  if (!isUser(req)) return res.redirect('/blog/login');

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const newNick = ((req.body && req.body.nickname) || '').trim();

  if (!isValidNickname(newNick)) { flashSet(req, 'Error: Nickname must be 1\u201330 characters (letters, numbers, spaces, _ -).'); return res.redirect('/blog/profile'); }
  if (daysSince(user.nicknameChangedAt) < NICK_COOLDOWN_DAYS) { flashSet(req, `Error: Nickname cooldown active - try again in ${nickTimeRemaining(user.nicknameChangedAt)}.`); return res.redirect('/blog/profile'); }

  const users  = readData('users.json');
  const admins = readData('admins.json');

  if (isReservedNick(newNick, admins)) { flashSet(req, 'Error: That nickname is reserved.'); return res.redirect('/blog/profile'); }
  if (users.find(u => u.id !== user.id && u.nickname.toLowerCase() === newNick.toLowerCase())) { flashSet(req, 'Error: That nickname is already taken.'); return res.redirect('/blog/profile'); }

  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) { req.session.destroy(); return res.redirect('/blog/login'); }

  users[idx].nickname          = newNick;
  users[idx].nicknameChangedAt = new Date().toISOString();
  writeData('users.json', users);

  flashSet(req, `Nickname changed to "${newNick}". Next change available in ${NICK_COOLDOWN_DAYS} days.`);
  res.redirect('/blog/profile');
});

// ── Change password ───────────────────────────────────────────────────────────

router.post('/profile/password', async (req, res) => {
  if (!isUser(req)) return res.redirect('/blog/login');

  const user = getCurrentUser(req);
  if (!user) { req.session.destroy(); return res.redirect('/blog/login'); }

  const currentPassword = (req.body && req.body.currentPassword) || '';
  const newPassword     = (req.body && req.body.newPassword)     || '';
  const newPassword2    = (req.body && req.body.newPassword2)    || '';

  if (!currentPassword) { flashSet(req, 'Error: Current password is required.'); return res.redirect('/blog/profile'); }
  if (newPassword.length < 8) { flashSet(req, 'Error: New password must be at least 8 characters.'); return res.redirect('/blog/profile'); }
  if (newPassword !== newPassword2) { flashSet(req, 'Error: New passwords do not match.'); return res.redirect('/blog/profile'); }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) { flashSet(req, 'Error: Current password is incorrect.'); return res.redirect('/blog/profile'); }

  const newHash = await bcrypt.hash(newPassword, 12);
  const users   = readData('users.json');
  const idx     = users.findIndex(u => u.id === user.id);
  if (idx === -1) { req.session.destroy(); return res.redirect('/blog/login'); }

  users[idx].passwordHash = newHash;
  writeData('users.json', users);

  flashSet(req, 'Password changed successfully.');
  res.redirect('/blog/profile');
});

module.exports = router;
