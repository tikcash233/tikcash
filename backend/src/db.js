import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// First try default .env (cwd). If DATABASE_URL still missing, fallback to backend/.env relative to this file.
dotenv.config();
if (!process.env.DATABASE_URL) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const altPath = path.join(__dirname, '../.env');
    dotenv.config({ path: altPath });
  } catch (_) { /* ignore */ }
}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
}

const connectionString = (process.env.DATABASE_URL || '').replace(/^['"]|['"]$/g, '');

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    // basic log in dev
    // console.log('executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
