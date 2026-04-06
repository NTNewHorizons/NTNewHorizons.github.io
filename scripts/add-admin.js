#!/usr/bin/env node
/**
 * scripts/add-admin.js
 *
 * Interactive CLI tool to add or update admin accounts.
 * Run from the site root: node scripts/add-admin.js
 *
 * Admins log in with their email address, just like regular users,
 * but are checked against blog-data/admins.json instead of users.json.
 * Passwords are stored as bcrypt hashes (cost factor 12).
 */

'use strict';

const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const DATA_FILE = path.join(__dirname, '..', 'blog-data', 'admins.json');

// Ensure blog-data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let admins = [];
try {
  admins = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(admins)) admins = [];
} catch {
  admins = [];
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function main() {
  console.log('\n=== NT:NH Blog - Add/Update Admin ===\n');

  const email       = (await ask('Email address (used to log in): ')).trim().toLowerCase();
  const displayName = (await ask('Display name (shown on posts, e.g. "Bob"): ')).trim();

  if (!isValidEmail(email)) {
    console.error('Error: please enter a valid email address.');
    rl.close(); process.exit(1);
  }

  if (!displayName) {
    console.error('Error: display name cannot be empty.');
    rl.close(); process.exit(1);
  }

  // Hide password input (simple approach - readline doesn't support it natively)
  const password = (await ask('Password (input visible - run in private terminal): ')).trim();

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    rl.close(); process.exit(1);
  }

  console.log('\nHashing password (this takes a moment)...');
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = admins.findIndex(a => a.email === email);
  const record   = { email, displayName, passwordHash };

  if (existing !== -1) {
    admins[existing] = record;
    console.log(`\nUpdated admin: ${email} (${displayName})`);
  } else {
    admins.push(record);
    console.log(`\nAdded admin: ${email} (${displayName})`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(admins, null, 2));
  console.log(`Saved to ${DATA_FILE}`);
  console.log('\nAdmins can now log in via /blog/login or /blog/admin using their email.\n');
  console.log('Restart the server if it is running.\n');

  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
