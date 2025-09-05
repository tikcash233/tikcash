import fs from 'fs';
import path from 'path';
import url from 'url';
import { query } from './db.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getRanMigrations() {
  const res = await query('SELECT name FROM _migrations ORDER BY id');
  return new Set(res.rows.map(r => r.name));
}

async function run() {
  await ensureMigrationsTable();
  const ran = await getRanMigrations();
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (ran.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log('Running migration', file);
    await query(sql);
    await query('INSERT INTO _migrations(name) VALUES($1)', [file]);
  }
  console.log('Migrations complete');
  process.exit(0);
}

run().catch((e) => {
  console.error('Migration failed', e);
  process.exit(1);
});
