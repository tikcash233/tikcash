import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { z } from 'zod';
import { CreatorCreateSchema, CreatorUpdateSchema, TransactionCreateSchema, RegisterSchema, LoginSchema, RequestVerifySchema, VerifyCodeSchema } from './schemas.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { listCreators, createCreator, updateCreator, getCreatorById } from './models/creators.js';
import { listTransactionsForCreator, createTipAndApply, createTransaction } from './models/transactions.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// CORS
// Comma-separated allowlist for frontend URLs
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow same-origin/no origin
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

if (process.env.NODE_ENV !== 'production') {
  // Log only problematic requests (status >= 400)
  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
  }));
}

// Basic rate limit (tune for production / per-route)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(limiter);

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies?.token || null);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Avoid noisy 404 for favicon requests
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Auth routes
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const { email, password, name } = data;
    const hashed = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users(email, password_hash, name) VALUES($1,$2,$3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), hashed, name || null]
    );
    const user = r.rows[0];
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ user, token });
  } catch (e) { 
    if (e.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    next(e); 
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const { email, password } = data;
    const r = await pool.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (e) { next(e); }
});

app.get('/api/auth/me', authRequired, async (req, res, next) => {
  try {
    const r = await pool.query('SELECT id, email, name, email_verified FROM users WHERE id = $1', [req.user.sub]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (e) { next(e); }
});

// Request email verification code
app.post('/api/auth/request-verify', async (req, res, next) => {
  try {
    const { email } = RequestVerifySchema.parse(req.body);
    const r = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ ok: true });
    const code = String(Math.floor(100000 + Math.random()*900000));
    await pool.query('INSERT INTO email_verification_codes(user_id, email, code) VALUES($1,$2,$3)', [user.id, email.toLowerCase(), code]);
    if (RESEND_API_KEY) {
      // TODO: Integrate Resend here. For now, we only log to server.
      console.log(`[email] Verification code for ${email}: ${code}`);
    } else {
      console.log(`[email:DEV] Verification code for ${email}: ${code}`);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Verify code
app.post('/api/auth/verify', async (req, res, next) => {
  try {
    const { email, code } = VerifyCodeSchema.parse(req.body);
    const r = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const vc = await pool.query(
      'SELECT * FROM email_verification_codes WHERE user_id=$1 AND email=$2 AND code=$3 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1',
      [user.id, email.toLowerCase(), code]
    );
    if (!vc.rows[0]) return res.status(400).json({ error: 'Invalid or expired code' });
    await pool.query('UPDATE email_verification_codes SET used_at = now() WHERE id = $1', [vc.rows[0].id]);
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Creators
app.get('/api/creators', async (req, res, next) => {
  try {
  const { sort, category, search, created_by } = req.query;
  const list = await listCreators({ sort, category, search, created_by });
    res.json(list);
  } catch (e) { next(e); }
});

app.post('/api/creators', async (req, res, next) => {
  try {
    const data = CreatorCreateSchema.parse(req.body);
    // If an email is provided in created_by, require that user to be verified
    if (data.created_by) {
      const rr = await pool.query('SELECT email_verified FROM users WHERE email = $1', [String(data.created_by).toLowerCase()]);
      const u = rr.rows[0];
      if (!u || !u.email_verified) {
        return res.status(403).json({ error: 'Please verify your email before creating a profile.' });
      }
    }
    const created = await createCreator(data);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.patch('/api/creators/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const patch = CreatorUpdateSchema.parse(req.body);
    const updated = await updateCreator(id, patch);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

app.get('/api/creators/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const creator = await getCreatorById(id);
    if (!creator) return res.status(404).json({ error: 'Not found' });
    res.json(creator);
  } catch (e) { next(e); }
});

// Transactions
app.get('/api/creators/:id/transactions', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const list = await listTransactionsForCreator(id, { limit: Number(req.query.limit) || 50 });
  // cast numeric amount
  const normalized = list.map(r => ({ ...r, amount: r.amount != null ? Number(r.amount) : r.amount }));
  res.json(normalized);
  } catch (e) { next(e); }
});

app.post('/api/transactions', async (req, res, next) => {
  try {
    const data = TransactionCreateSchema.parse(req.body);
    // For tips/withdrawals, apply balance updates atomically
  const created = await createTipAndApply(data);
  const normalized = { ...created, amount: created.amount != null ? Number(created.amount) : created.amount };
  res.status(201).json(normalized);
  } catch (e) { next(e); }
});

// Simple OpenAPI docs endpoint
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: "3.0.0",
    info: { title: "TikCash API", version: "1.0.0" },
    paths: {
      "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
  "/api/auth/register": { post: { summary: "Register", requestBody: {}, responses: { "201": { description: "Created" } } } },
  "/api/auth/login": { post: { summary: "Login", requestBody: {}, responses: { "200": { description: "OK" } } } },
  "/api/auth/me": { get: { summary: "Me", responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } } } },
      "/api/creators": {
        get: { summary: "List creators", parameters: [], responses: { "200": { description: "List" } } },
        post: { summary: "Create creator", requestBody: {}, responses: { "201": { description: "Created" } } }
      },
  "/api/auth/request-verify": { post: { summary: "Request email verification code", requestBody: {}, responses: { "200": { description: "OK" } } } },
  "/api/auth/verify": { post: { summary: "Verify email code", requestBody: {}, responses: { "200": { description: "OK" } } } },
      "/api/creators/{id}": {
        get: { summary: "Get creator", parameters: [], responses: { "200": { description: "Creator" } } },
        patch: { summary: "Update creator", requestBody: {}, responses: { "200": { description: "Updated" } } }
      },
      "/api/creators/{id}/transactions": {
        get: { summary: "List transactions for creator", parameters: [], responses: { "200": { description: "List" } } }
      },
      "/api/transactions": {
        post: { summary: "Create transaction", requestBody: {}, responses: { "201": { description: "Created" } } }
      }
    }
  });
});

// Error handler
app.use((err, req, res, _next) => {
  // Log unexpected errors to the console
  // (still quiet for successful requests)
  if (err) console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Invalid request', details: err.errors });
  }
  // Duplicate key (unique constraint) -> return friendly conflict
  if (err.code === '23505') {
    const msg = err.constraint === 'creators_tiktok_username_key'
      ? 'TikTok username already exists. Choose a different one.'
      : 'Duplicate value violates a unique constraint.';
    return res.status(409).json({ error: msg });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`✅ API server listening on http://localhost:${port}`);
});
