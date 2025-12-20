#!/usr/bin/env node
import { query } from '../src/db.js';
import bcrypt from 'bcryptjs';

async function run() {
  const [,, email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/auth_timing.js <email> <password>');
    process.exit(2);
  }
  try {
    const dbStart = Date.now();
    const res = await query('SELECT id, email, password_hash FROM tikcash_users WHERE email = $1 LIMIT 1', [String(email).toLowerCase()]);
    const dbDur = Date.now() - dbStart;
    console.log('[timing] DB lookup took', dbDur, 'ms');

    const user = res.rows[0];
    if (!user) {
      console.log('User not found');
      process.exit(0);
    }

    const bcryptStart = Date.now();
    const ok = await bcrypt.compare(password, user.password_hash);
    const bcryptDur = Date.now() - bcryptStart;
    console.log('[timing] bcrypt.compare took', bcryptDur, 'ms');
    console.log('[result] password match:', ok);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
