'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// USER AUTH ROUTES — registration, login, logout, and email verification.
// ──────────────────────────────────────────────────────────────────────────────

const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');

const router = express.Router();

const { readData, writeData } = require('../data');
const {
  escapeHtml, flashGet, flashSet, isUser, isAdmin,
  isValidEmail, hasEmailDomain, isValidNickname, isReservedNick,
  RESEND_API_KEY, VERIFICATION_EXPIRY_HOURS, sendVerificationEmail,
} = require('../helpers');
const { page, topNav, flashHtml } = require('../render');

// ── Register (form) ───────────────────────────────────────────────────────────

router.get('/register', (req, res) => {
  if (isUser(req) || isAdmin(req)) return res.redirect('/blog');
  const flash = flashGet(req);
  res.send(page('Create Account - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Create Account</h2>
  ${flashHtml(flash)}
  <form method="POST" action="/blog/register" autocomplete="on">
    <div class="field-group">
      <label class="field-label" for="r-email">Email address</label>
      <input class="auth-input" id="r-email" type="email" name="email"
             maxlength="200" autocomplete="email" required placeholder="you@example.com" />
      <span class="field-hint">Used to log in. Never shown publicly.</span>
    </div>
    <div class="field-group">
      <label class="field-label" for="r-nick">Nickname</label>
      <input class="auth-input" id="r-nick" type="text" name="nickname"
             maxlength="30" autocomplete="username" required placeholder="CoolPlayer123" />
      <span class="field-hint">Your public display name (1&ndash;30 chars, letters / numbers / spaces / _ -).</span>
    </div>
    <div class="field-group">
      <label class="field-label" for="r-pw">Password</label>
      <input class="auth-input" id="r-pw" type="password" name="password"
             autocomplete="new-password" required placeholder="At least 8 characters" />
    </div>
    <div class="field-group">
      <label class="field-label" for="r-pw2">Confirm password</label>
      <input class="auth-input" id="r-pw2" type="password" name="password2"
             autocomplete="new-password" required placeholder="Repeat your password" />
    </div>
    <button class="auth-submit full" type="submit">[ CREATE ACCOUNT ]</button>
  </form>
  <div class="auth-switch">
    Already have an account? <a href="/blog/login">[Login]</a><br><br>
    <a href="/blog">&lt; Back to blog</a>
  </div>
</div>`));
});

// ── Register (submit) ─────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  if (isUser(req)) return res.redirect('/blog');

  const email     = ((req.body && req.body.email)     || '').trim().toLowerCase();
  const nickname  = ((req.body && req.body.nickname)  || '').trim();
  const password  = ((req.body && req.body.password)  || '');
  const password2 = ((req.body && req.body.password2) || '');

  if (!isValidEmail(email)) { flashSet(req, 'Error: Please enter a valid email address.'); return res.redirect('/blog/register'); }
  if (!(await hasEmailDomain(email))) { flashSet(req, 'Error: Email domain does not exist or does not accept mail.'); return res.redirect('/blog/register'); }
  if (!isValidNickname(nickname)) { flashSet(req, 'Error: Nickname must be 1\u201330 characters (letters, numbers, spaces, _ -).'); return res.redirect('/blog/register'); }
  if (password.length < 8) { flashSet(req, 'Error: Password must be at least 8 characters.'); return res.redirect('/blog/register'); }
  if (password !== password2) { flashSet(req, 'Error: Passwords do not match.'); return res.redirect('/blog/register'); }

  const users  = readData('users.json');
  const admins = readData('admins.json');

  if (users.find(u => u.email === email)) { flashSet(req, 'Error: An account with that email already exists.'); return res.redirect('/blog/register'); }
  if (isReservedNick(nickname, admins)) { flashSet(req, 'Error: That nickname is reserved.'); return res.redirect('/blog/register'); }
  if (users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase())) { flashSet(req, 'Error: That nickname is already taken. Please choose another.'); return res.redirect('/blog/register'); }

  const passwordHash = await bcrypt.hash(password, 12);
  const hasResend = !!RESEND_API_KEY();

  if (hasResend) {
    // Email verification flow
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = {
      id:                     crypto.randomBytes(12).toString('hex'),
      email,
      nickname,
      passwordHash,
      verified:               false,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 3600000).toISOString(),
      registeredAt:           new Date().toISOString(),
      nicknameChangedAt:      null,
    };

    users.push(newUser);
    writeData('users.json', users);

    const sent = await sendVerificationEmail(email, verificationToken);
    if (sent) {
      flashSet(req, 'Account created! Check your email for a verification link.');
    } else {
      flashSet(req, 'Account created, but we could not send the verification email. Visit /blog/resend-verification to try again.');
    }
    res.redirect('/blog/verify-sent');
  } else {
    // No Resend configured — still require verification, store as unverified
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = {
      id:                     crypto.randomBytes(12).toString('hex'),
      email,
      nickname,
      passwordHash,
      verified:               false,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 3600000).toISOString(),
      registeredAt:           new Date().toISOString(),
      nicknameChangedAt:      null,
    };

    users.push(newUser);
    writeData('users.json', users);

    flashSet(req, 'Account created, but email verification is not configured. Contact an admin to activate your account.');
    res.redirect('/blog/verify-sent');
  }
});

// ── Login (form + submit) ─────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (isUser(req) || isAdmin(req)) return res.redirect('/blog');
  const flash = flashGet(req);
  res.send(page('Login - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Login</h2>
  ${flashHtml(flash)}
  <form method="POST" action="/blog/login" autocomplete="on">
    <div class="field-group">
      <label class="field-label" for="l-email">Email address</label>
      <input class="auth-input" id="l-email" type="email" name="email"
             autocomplete="email" required placeholder="you@example.com" />
    </div>
    <div class="field-group">
      <label class="field-label" for="l-pw">Password</label>
      <input class="auth-input" id="l-pw" type="password" name="password"
             autocomplete="current-password" required placeholder="Your password" />
    </div>
    <button class="auth-submit full" type="submit">[ LOGIN ]</button>
  </form>
  <div class="auth-switch">
    No account yet? <a href="/blog/register">[Create one - it&apos;s free]</a><br><br>
    <a href="/blog">&lt; Back to blog</a>
  </div>
</div>`));
});

router.post('/login', async (req, res) => {
  if (isUser(req) || isAdmin(req)) return res.redirect('/blog');

  const email    = ((req.body && req.body.email)    || '').trim().toLowerCase();
  const password = ((req.body && req.body.password) || '');
  const FAIL     = 'Error: Invalid email or password.';

  // Check regular users first
  const users = readData('users.json');
  const user  = users.find(u => u.email === email);

  if (user) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { flashSet(req, FAIL); return res.redirect('/blog/login'); }
    if (user.verified !== true) {
      flashSet(req, 'Error: Please verify your email before logging in. <a href="/blog/verify-sent">Resend verification email</a>.');
      return res.redirect('/blog/login');
    }
    req.session.user = { id: user.id };
    flashSet(req, `Welcome back, ${user.nickname}!`);
    return res.redirect('/blog');
  }

  // Check admins by email
  const admins = readData('admins.json');
  const admin  = admins.find(a => a.email === email);

  if (admin) {
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) { flashSet(req, FAIL); return res.redirect('/blog/login'); }
    req.session.adminUser = { email: admin.email, displayName: admin.displayName };
    flashSet(req, `Welcome, ${admin.displayName}!`);
    return res.redirect('/blog/admin');
  }

  // Neither matched - run dummy hash to prevent timing attacks
  await bcrypt.compare(password, '$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  flashSet(req, FAIL);
  res.redirect('/blog/login');
});

router.post('/user/logout', (req, res) => {
  delete req.session.user;
  flashSet(req, 'You have been logged out.');
  res.redirect('/blog');
});

// ── Email verification ────────────────────────────────────────────────────────

router.get('/verify-sent', (req, res) => {
  const flash = flashGet(req);
  res.send(page('Verify your email - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Check your email</h2>
  ${flashHtml(flash)}
  <p>We sent a verification link to the email address you registered with.</p>
  <p>Click the link in the email to activate your account.</p>
  <p style="margin-top:20px;">
    <a href="/blog/resend-verification" class="auth-submit" style="display:inline-block;text-decoration:none;padding:6px 20px;">[ Resend verification email ]</a>
  </p>
  <div class="auth-switch">
    <a href="/blog/login">[Back to Login]</a>
  </div>
</div>`));
});

router.get('/verify/:token', async (req, res) => {
  const token = req.params.token;
  if (!token) return res.redirect('/blog');

  const users = readData('users.json');
  const idx   = users.findIndex(u => u.verificationToken === token);

  if (idx === -1) {
    return res.send(page('Verification failed - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Verification failed</h2>
  <div class="msg error">Invalid or expired verification link.</div>
  <div class="auth-switch">
    <a href="/blog/register">[Create a new account]</a><br>
    <a href="/blog">[Back to blog]</a>
  </div>
</div>`));
  }

  const user = users[idx];
  if (user.verified) {
    return res.send(page('Already verified - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Already verified</h2>
  <div class="msg success">Your email is already verified. You can log in.</div>
  <div class="auth-switch">
    <a href="/blog/login">[Go to Login]</a>
  </div>
</div>`));
  }

  const expiresAt = new Date(user.verificationTokenExpiresAt).getTime();
  if (Date.now() > expiresAt) {
    return res.send(page('Link expired - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Link expired</h2>
  <div class="msg error">This verification link has expired.</div>
  <div class="auth-switch">
    <a href="/blog/resend-verification">[Resend verification email]</a><br>
    <a href="/blog">[Back to blog]</a>
  </div>
</div>`));
  }

  users[idx].verified               = true;
  users[idx].verificationToken      = null;
  users[idx].verificationTokenExpiresAt = null;
  writeData('users.json', users);

  res.send(page('Email verified - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Email verified!</h2>
  <div class="msg success">Your email has been verified. You can now log in.</div>
  <div class="auth-switch">
    <a href="/blog/login">[Go to Login]</a>
  </div>
</div>`));
});

// ── Resend verification email ─────────────────────────────────────────────────

router.all('/resend-verification', async (req, res) => {
  const email = ((req.body && req.body.email) || (req.query && req.query.email) || '').trim().toLowerCase();
  const flash = flashGet(req);

  if (!email) {
    return res.send(page('Resend verification - NT:NH Blog', `
${topNav(req)}
<div class="auth-wrap">
  <h2>Resend verification email</h2>
  ${flashHtml(flash)}
  <form method="POST" action="/blog/resend-verification">
    <div class="field-group">
      <label class="field-label" for="rv-email">Your email address</label>
      <input class="auth-input" id="rv-email" type="email" name="email" required placeholder="you@example.com" />
    </div>
    <button class="auth-submit full" type="submit">[ RESEND ]</button>
  </form>
  <div class="auth-switch">
    <a href="/blog/login">[Back to Login]</a>
  </div>
</div>`));
  }

  const users = readData('users.json');
  const user  = users.find(u => u.email === email);

  // Generic response either way - never reveal whether the account exists.
  if (!user || user.verified) {
    flashSet(req, 'If an account exists for that email, a verification link has been sent. Already-verified accounts can simply log in.');
    return res.redirect('/blog/verify-sent');
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].verificationToken           = verificationToken;
  users[idx].verificationTokenExpiresAt  = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 3600000).toISOString();
  writeData('users.json', users);

  const sent = await sendVerificationEmail(email, verificationToken);
  if (sent) {
    flashSet(req, 'Verification email sent! Check your inbox.');
  } else {
    flashSet(req, 'Error: Could not send verification email. Please try again later.');
  }
  res.redirect('/blog/verify-sent');
});

module.exports = router;
