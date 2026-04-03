#!/usr/bin/env node
/**
 * scripts/add-admin.js
 *
 * Interactive CLI tool to add or update admin accounts.
 * Run from the site root: node scripts/add-admin.js
 *
 * Passwords are stored as bcrypt hashes (cost factor 12).
 * You can also manually edit blog-data/admins.json and run this
 * script to re-hash a plaintext password you've put there —
 * just delete the passwordHash field and re-run.
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
} catch {
  admins = [];
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n=== NT:NH Blog — Add/Update Admin ===\n');

  const username    = (await ask('Username (alphanumeric, no spaces): ')).trim();
  const displayName = (await ask('Display name (shown on posts, e.g. "Bob"): ')).trim();

  if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    console.error('Error: username must be alphanumeric (a-z, 0-9, _, -)');
    rl.close(); process.exit(1);
  }

  // Hide password input (simple approach — readline doesn't support it natively)
  const password = (await ask('Password (input visible — run in private terminal): ')).trim();

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    rl.close(); process.exit(1);
  }

  console.log('\nHashing password (this takes a moment)...');
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = admins.findIndex(a => a.username === username);
  const record   = { username, displayName: displayName || username, passwordHash };

  if (existing !== -1) {
    admins[existing] = record;
    console.log(`\nUpdated admin: ${username}`);
  } else {
    admins.push(record);
    console.log(`\nAdded admin: ${username}`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(admins, null, 2));
  console.log(`Saved to ${DATA_FILE}`);
  console.log('\nDone! Restart the server if it is running.\n');

  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
