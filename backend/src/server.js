import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool, getPoolStats, closePool } from './db.js'; // Fixed import
import { z } from 'zod';
import { CreatorCreateSchema, CreatorUpdateSchema, TransactionCreateSchema, RegisterSchema, LoginSchema, RequestVerifySchema, VerifyCodeSchema, ResetWithPinSchema, ChangePasswordSchema } from './schemas.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { listCreators, createCreator, updateCreator, getCreatorById } from './models/creators.js';
import { listTransactionsForCreator, createTipAndApply, createTransaction, getTransactionByReference, completePendingTip, getByIdempotency, attachAuthorizationUrl, expireOldPendingTips, listCreatorsSupportedByUser } from './models/transactions.js';
import { initializePaystackTransaction } from './payments/paystack.js';
import { txEvents, emitTransactionEvent } from './events.js';
import crypto from 'node:crypto';
import http from 'http';

dotenv.config();

// Activity tracking for smart resource management
let lastActivityTime = Date.now();
let activeSSEConnections = new Set();
const IDLE_THRESHOLD = 30 * 60 * 1000; // 30 minutes of inactivity

// Helper to update activity timestamp
function recordActivity() {
  lastActivityTime = Date.now();
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(compression());
// Capture raw body for Paystack webhook signature verification while still parsing JSON normally elsewhere
app.use((req, res, next) => {
  const isPaystackWebhook = req.url.startsWith('/api/paystack/webhook') || req.url.startsWith('/api/payments/paystack/webhook');
  if (isPaystackWebhook) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      try { req.body = JSON.parse(data || '{}'); } catch { req.body = {}; }
      next();
    });
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});

// CORS
// Comma-separated allowlist for frontend URLs
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow same-origin/no origin
    
    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production' && origin?.includes('localhost')) {
      return cb(null, true);
    }
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Activity tracking middleware for important endpoints
app.use((req, res, next) => {
  // Track activity for user-facing endpoints (exclude health checks, static assets)
  const importantPaths = ['/api/creators', '/api/transactions', '/api/payments', '/api/auth'];
  const isImportant = importantPaths.some(path => req.url.startsWith(path));
  if (isImportant) {
    recordActivity();
  }
  next();
});

if (process.env.NODE_ENV !== 'production') {
  // Log only problematic requests (status >= 400)
  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
  }));
}

// Basic rate limit (tune for production / per-route)
// In development, disable to avoid noisy 429s during local testing
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const p = req.path || '';
      return (
        p.startsWith('/api/paystack/webhook') ||
        p.startsWith('/api/payments/paystack/webhook') ||
        p.startsWith('/api/stream/')
      );
    }
  });
  app.use(limiter);
}

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || '';
const RESEND_SEND_IN_DEV = (process.env.RESEND_SEND_IN_DEV || 'false').toLowerCase() === 'true';
const RESEND_TEST_EMAIL = (process.env.RESEND_TEST_EMAIL || '').toLowerCase();

async function sendVerificationEmail(to, code) {
  const isProd = process.env.NODE_ENV === 'production';
  const from = isProd ? (RESEND_FROM || 'onboarding@resend.dev') : 'onboarding@resend.dev';
  const toLower = String(to || '').toLowerCase();

  // Development-friendly behavior: by default, don't call Resend.
  if (!isProd) {
    if (!RESEND_SEND_IN_DEV) {
      console.log(`[email:DEV] Verification code for ${toLower}: ${code}`);
      return;
    }
    // If sending in dev is enabled, only allow a single test recipient (your own email)
    if (RESEND_TEST_EMAIL && toLower !== RESEND_TEST_EMAIL) {
      console.log(`[email:DEV] Skipping send to ${toLower}. Allowed test email is ${RESEND_TEST_EMAIL}. Code: ${code}`);
      return;
    }
  }
  // If we reach here, attempt real send (production or explicitly enabled dev)
  if (!RESEND_API_KEY) {
    console.log(`[email:DEV] Verification code for ${toLower}: ${code}`);
    return;
  }
  try {
    const payload = {
      from,
      to,
      subject: 'Your TikCash verification code',
      text: `Your TikCash verification code is ${code}. It expires in 15 minutes.`,
    };
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  if (!resp.ok) {
      const body = await resp.text();
      console.error(`Resend API error: ${resp.status} ${resp.statusText} - ${body}`);
      throw new Error(`Resend API responded with ${resp.status}`);
    }
  } catch (err) {
    console.error('Failed to send verification email:', err?.message || err);
    console.log(`[email:FALLBACK] Verification code for ${to}: ${code}`);
  }
}
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

// Public config so frontend knows if webhook mode is enabled (used to reduce polling)
app.get('/api/config', (req, res) => {
  const webhookEnabled = (process.env.ENABLE_PAYSTACK_WEBHOOK || 'true').toLowerCase() === 'true';
  res.json({ webhookEnabled });
});

// Avoid noisy 404 for favicon requests
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Toggle: skip email verification in this mode; can be re-enabled later
const VERIFY_EMAIL = (process.env.VERIFY_EMAIL || 'false').toLowerCase() === 'true';

// Auth routes
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const { email, password, name, role, recovery_pin } = data;
    const hashed = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(recovery_pin, 10);
    const r = await pool.query(
      'INSERT INTO users(email, password_hash, name, role, email_verified, recovery_pin_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING RETURNING id, email, name, role, email_verified, created_at',
      [email.toLowerCase(), hashed, name || null, role || 'supporter', VERIFY_EMAIL ? false : true, pinHash]
    );
    const user = r.rows[0];
    if (!user) return res.status(409).json({ error: 'Email already in use.' });
    // If VERIFY_EMAIL is true, you can re-enable code sending here later.
    // If registering as creator, optionally create the profile immediately
    if ((role || 'supporter') === 'creator') {
      const creatorPayload = {
        tiktok_username: data.tiktok_username,
        display_name: data.display_name || name || email.split('@')[0],
        phone_number: data.phone_number,
        preferred_payment_method: data.preferred_payment_method || 'momo',
        category: data.category || 'other',
        created_by: user.email,
      };
      if (creatorPayload.tiktok_username && creatorPayload.display_name) {
        try { await createCreator(creatorPayload); } catch (err) { if (err?.code !== '23505') console.error('createCreator failed', err); }
      }
    }
  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ user, token });
  } catch (e) { 
    if (e.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    next(e); 
  }
});

// Reset password with 4-digit PIN (no email needed)
app.post('/api/auth/reset-with-pin', async (req, res, next) => {
  try {
    const { email, pin, new_password } = ResetWithPinSchema.parse(req.body);
    const ur = await pool.query('SELECT id, recovery_pin_hash, failed_pin_attempts, pin_locked_until FROM users WHERE email = $1', [email.toLowerCase()]);
    const u = ur.rows[0];
    // Do not reveal existence
    if (!u) return res.status(200).json({ ok: true });
    if (u.pin_locked_until && new Date(u.pin_locked_until) > new Date()) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    const ok = u.recovery_pin_hash && await bcrypt.compare(pin, u.recovery_pin_hash);
    if (!ok) {
      const attempts = (u.failed_pin_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query('UPDATE users SET failed_pin_attempts=$2, pin_locked_until=$3 WHERE id=$1', [u.id, attempts, lockUntil]);
      return res.status(400).json({ error: 'Invalid PIN.' });
    }
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$2, failed_pin_attempts=0, pin_locked_until=NULL WHERE id=$1', [u.id, newHash]);
    return res.status(200).json({ ok: true });
  } catch (e) { next(e); }
});

// Change password for logged-in users
app.post('/api/auth/change-password', authRequired, async (req, res, next) => {
  try {
    const { current_password, new_password } = ChangePasswordSchema.parse(req.body);
    const ur = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.sub]);
    const u = ur.rows[0];
    if (!u?.password_hash) return res.status(400).json({ error: 'No password set.' });
    const match = await bcrypt.compare(current_password, u.password_hash);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user.sub, newHash]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const { email, password } = data;
  const r = await pool.query('SELECT id, email, name, role, email_verified, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken({ sub: user.id, email: user.email });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, email_verified: user.email_verified }, token });
  } catch (e) { next(e); }
});

app.get('/api/auth/me', authRequired, async (req, res, next) => {
  try {
  const r = await pool.query('SELECT id, email, name, role, email_verified FROM users WHERE id = $1', [req.user.sub]);
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
  await sendVerificationEmail(email, code);
    const payload = { ok: true };
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      payload.dev_code = code; // helps beginners test locally
    }
    res.json(payload);
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

// DEV helper: fetch latest verification code for an email (non-production only)
app.get('/api/auth/dev-latest-code', async (req, res, next) => {
  try {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    const email = String(req.query.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const ur = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const user = ur.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const vc = await pool.query(
      'SELECT code FROM email_verification_codes WHERE user_id=$1 AND email=$2 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1',
      [user.id, email]
    );
    if (!vc.rows[0]) return res.status(404).json({ error: 'No active code' });
    res.json({ code: vc.rows[0].code });
  } catch (e) { next(e); }
});

// Creators
app.get('/api/creators', async (req, res, next) => {
  try {
    const { sort, category, search, created_by } = req.query;
    const list = await listCreators({ sort, category, search, created_by });
    res.json(list);
  } catch (e) { 
    if (e.isNetworkError || e.message === 'DATABASE_OFFLINE' || e.message === 'DATABASE_CIRCUIT_OPEN') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection lost. Please try again later.',
        retryAfter: 30 
      });
    }
    next(e); 
  }
});

app.post('/api/creators', authRequired, async (req, res, next) => {
  try {
  const body = CreatorCreateSchema.parse(req.body);
  // Enforce account + verified email
  const ur = await pool.query('SELECT email, email_verified FROM users WHERE id = $1', [req.user.sub]);
  const u = ur.rows[0];
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  if (!u.email_verified) return res.status(403).json({ error: 'Please verify your email before creating a profile.' });
  const payload = { ...body, created_by: u.email };
  const created = await createCreator(payload);
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

// Creator search (public endpoint) — must be before /:id to avoid route capture
app.get('/api/creators/search', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 24 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ data: [], page: parseInt(page), pageSize: parseInt(limit), hasMore: false });
    }
    const searchTerm = q.trim();
    const list = await listCreators({ search: searchTerm, sort: '-total_earnings' });
    // Simple pagination on the result (since listCreators has a 200 limit)
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const paginatedResults = list.slice(start, start + limitNum);
    res.json({
      data: paginatedResults,
      page: pageNum,
      pageSize: limitNum,
      hasMore: start + limitNum < list.length
    });
  } catch (e) { 
    if (e.isNetworkError || e.message === 'DATABASE_OFFLINE' || e.message === 'DATABASE_CIRCUIT_OPEN') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection lost. Please try again later.',
        retryAfter: 30 
      });
    }
    next(e); 
  }
});

app.get('/api/creators/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const creator = await getCreatorById(id);
    if (!creator) return res.status(404).json({ error: 'Not found' });
    res.json(creator);
  } catch (e) { 
    if (e.isNetworkError || e.message === 'DATABASE_OFFLINE' || e.message === 'DATABASE_CIRCUIT_OPEN') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection lost. Please try again later.',
        retryAfter: 30 
      });
    }
    next(e); 
  }
});

// My supported creators (requires auth)
app.get('/api/me/creators', authRequired, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const list = await listCreatorsSupportedByUser(req.user.sub, { page, limit });
    res.json({
      data: list,
      page,
      pageSize: limit,
      hasMore: list.length >= limit
    });
  } catch (e) { 
    if (e.isNetworkError || e.message === 'DATABASE_OFFLINE' || e.message === 'DATABASE_CIRCUIT_OPEN') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection lost. Please try again later.',
        retryAfter: 30 
      });
    }
    next(e); 
  }
});

// Creator search (public endpoint)

// Transactions
app.get('/api/creators/:id/transactions', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    let limit = 50;
    const rawLimit = req.query.limit;
    if (rawLimit === 'all') limit = 'all';
    else if (!isNaN(Number(rawLimit))) limit = Number(rawLimit) || 50;
    const list = await listTransactionsForCreator(id, { limit });
    // cast numeric amount
    const normalized = list.map(r => ({ ...r, amount: r.amount != null ? Number(r.amount) : r.amount }));
    res.json(normalized);
  } catch (e) { 
    // Handle network/database errors gracefully
    if (e.isNetworkError || e.message === 'DATABASE_OFFLINE' || e.message === 'DATABASE_CIRCUIT_OPEN') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection lost. Please try again later.',
        retryAfter: 30 
      });
    }
    next(e); 
  }
});

app.post('/api/transactions', async (req, res, next) => {
  try {
    const data = TransactionCreateSchema.parse(req.body);
    // Attach supporter_user_id if authenticated
    const header = req.headers.authorization || '';
    let supporterUserId = null;
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : (req.cookies?.token || null);
    if (token) {
      try { const dec = jwt.verify(token, JWT_SECRET); supporterUserId = dec?.sub || null; } catch {}
    }
    if (supporterUserId) data.supporter_user_id = supporterUserId;
    // For tips/withdrawals, apply balance updates atomically
  const created = await createTipAndApply(data);
  const normalized = { ...created, amount: created.amount != null ? Number(created.amount) : created.amount };
  res.status(201).json(normalized);
  } catch (e) { next(e); }
});

// Paystack: initiate a tip payment (create a pending transaction now, later completed by webhook)
app.post('/api/payments/paystack/initiate', async (req, res, next) => {
  try {
    const { creator_id, amount, supporter_name, message, supporter_email, idempotency_key } = req.body || {};
    if (!creator_id || typeof amount === 'undefined') return res.status(400).json({ error: 'creator_id and amount are required' });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: 'Amount must be > 0' });

    // Basic validation of idempotency key (client should send a stable random string)
    const idem = typeof idempotency_key === 'string' && idempotency_key.length >= 8 ? idempotency_key.slice(0, 128) : null;

    // STEP 1: If an existing pending/completed transaction already exists for this (creator + key + same amount), return it.
    if (idem) {
      const existing = await getByIdempotency(creator_id, idem);
      if (existing) {
        // If it already has an authorization URL (previous initiate call) just return that; ensures duplicate suppression.
        return res.json({
          authorization_url: existing.paystack_authorization_url || null,
          reference: existing.payment_reference,
          reused: true,
          status: existing.status,
        });
      }
    }

    // STEP 2: Create new pending transaction row first (so webhook can complete it later) with idempotency key.
    const reference = 'TIP_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    // Attach supporter_user_id if authenticated
    let supporterUserId = null;
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : (req.cookies?.token || null);
      if (token) { const dec = jwt.verify(token, JWT_SECRET); supporterUserId = dec?.sub || null; }
    } catch {}

    const pendingTx = await createTransaction({
      creator_id,
      supporter_name: supporter_name || null,
      amount: amt,
      message: message || null,
      transaction_type: 'tip',
      status: 'pending',
      payment_reference: reference,
      idempotency_key: idem,
      supporter_user_id: supporterUserId || null,
    });
    emitTransactionEvent(pendingTx);

    // STEP 3: Call Paystack. If the network fails AFTER DB insert, client retry with same key will reuse row above.
    const initData = await initializePaystackTransaction({
      amountGHS: amt,
      email: supporter_email || 'anon@example.com',
      reference,
      metadata: { creator_id, supporter_name, message },
      callbackUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:3000') + '/payment/result?ref=' + reference
    });

    // Persist authorization_url for future idempotent retries returning early
    if (initData?.authorization_url) {
      attachAuthorizationUrl(pendingTx.id, initData.authorization_url).catch(()=>{});
    }

    res.json({ authorization_url: initData.authorization_url, reference });
  } catch (e) { next(e); }
});

// Payment status check (manual polling without webhook tunnel)
app.get('/api/payments/paystack/status/:reference', async (req, res, next) => {
  try {
    const tx = await getTransactionByReference(req.params.reference);
    if (!tx) return res.status(404).json({ error: 'Not found' });
    res.json({ reference: tx.payment_reference, status: tx.status, amount: Number(tx.amount) });
  } catch (e) { next(e); }
});

// Manual verify route (use this after customer returns from Paystack if you don't have webhooks yet)
app.get('/api/payments/paystack/verify/:reference', async (req, res, next) => {
  try {
  const ref = (req.params.reference || '').trim();
    const tx = await getTransactionByReference(ref);
    if (!tx) return res.status(404).json({ error: 'Transaction not found (reference unknown)' });
    if (tx.status === 'completed') return res.json({ reference: ref, status: 'completed', amount: Number(tx.amount) });
    // Call Paystack verify API
    const { verifyPaystackTransaction } = await import('./payments/paystack.js');
    const data = await verifyPaystackTransaction(ref);
    if (data.status === 'success') {
      // finalize balances if not yet applied
      await completePendingTip(ref, Number(data.amount) / 100);
      const updated = await getTransactionByReference(ref);
  emitTransactionEvent(updated);
      return res.json({ reference: ref, status: updated.status, amount: Number(updated.amount) });
    }
    res.json({ reference: ref, status: tx.status });
  } catch (e) { next(e); }
});

// Paystack webhook handler (shared)
async function handlePaystackWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    // Lazy import to avoid circular top-level await
    const { verifyPaystackSignature } = await import('./payments/paystack.js');
    if (!verifyPaystackSignature || !verifyPaystackSignature(req.rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    const event = req.body;
    if (event?.event === 'charge.success') {
      const data = event.data;
      const ref = data?.reference;
      const metadata = data?.metadata || {};
      const creator_id = metadata.creator_id || null;
      const amountGHS = Number(data?.amount || 0) / 100; // pesewas -> GHS
      // Idempotent upsert: if we already have a pending row for this reference, complete it; otherwise create now
      try {
        const existing = await pool.query('SELECT id FROM transactions WHERE payment_reference = $1 LIMIT 1', [ref]);
        let finalTx = null;
        if (existing.rowCount > 0) {
          // Complete previously created pending transaction and apply balances
          finalTx = await completePendingTip(ref, amountGHS) || await getTransactionByReference(ref);
        } else if (creator_id) {
          // No row yet (e.g., user paid without pre-insert) → create completed tip and apply balances
          finalTx = await createTipAndApply({
            creator_id,
            supporter_name: metadata.supporter_name || data.customer?.email || 'Anonymous',
            amount: amountGHS,
            message: metadata.message || null,
            transaction_type: 'tip',
            status: 'completed',
            payment_reference: ref,
          });
        } else {
          // Missing creator_id and no existing tx; log for observability
          console.warn('[webhook] charge.success missing creator_id and no existing tx for ref', ref);
        }
        if (finalTx) emitTransactionEvent(finalTx);
      } catch (err) {
        console.error('Failed to persist Paystack tip', err);
      }
    }
    res.json({ received: true });
  } catch (e) { next(e); }
}

// Paystack webhook endpoints (both variants supported)
app.post('/api/paystack/webhook', handlePaystackWebhook);
app.post('/api/payments/paystack/webhook', handlePaystackWebhook);

// SSE (Server-Sent Events) stream for real-time transaction updates
app.get('/api/stream/transactions', (req, res) => {
  // CORS headers (already allowed globally but ensure for event stream)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Track this SSE connection
  const connectionId = crypto.randomUUID();
  activeSSEConnections.add(connectionId);
  recordActivity(); // SSE connection counts as activity

  const send = (payload) => {
    try {
      res.write(`event: tx\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_) { /* ignore */ }
  };

  const listener = (evt) => send(evt);
  txEvents.on('tx', listener);

  // Ping every 25s to keep connection alive (some proxies close idle >30s)
  const pingInterval = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    txEvents.off('tx', listener);
    activeSSEConnections.delete(connectionId);
  });
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
  post: { summary: "Create creator (auth + verified required)", requestBody: {}, responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" }, "403": { description: "Email not verified" } } }
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
      ,
      "/api/auth/reset-with-pin": {
        post: { summary: "Reset password with 4-digit PIN", requestBody: {}, responses: { "200": { description: "OK" } } }
      },
      "/api/auth/change-password": {
        post: { summary: "Change password (logged in)", requestBody: {}, responses: { "200": { description: "OK" } } }
      }
    }
  });

  // List creators the current supporter has supported (distinct), ordered by last tip date
  app.get('/api/me/creators', authRequired, async (req, res, next) => {
    try {
      const page = Number(req.query.page || '1');
      const limit = Number(req.query.limit || '24');
      const data = await listCreatorsSupportedByUser(req.user.sub, { page, limit });
      res.json({ data, page, pageSize: limit });
    } catch (e) { next(e); }
  });
});

// Error handler
app.use((err, req, res, _next) => {
  // Log unexpected errors to the console
  // (still quiet for successful requests)
  if (err && err.name !== 'ZodError') console.error(err);
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

const basePort = Number(process.env.PORT || 5000);
function startServer(port, attemptsLeft = 5) {
  const server = http.createServer(app);
  const onError = (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`⚠️  Port ${port} in use, trying ${nextPort}...`);
      // Give a tiny delay before retry
      setTimeout(() => startServer(nextPort, attemptsLeft - 1), 150);
    } else {
      console.error('Failed to start server:', err?.message || err);
      // Keep process alive under --watch; otherwise exit
      if (process.env.NODE_ENV === 'production') process.exit(1);
    }
  };
  server.once('error', onError);
  server.listen(port, () => {
    server.off('error', onError);
    console.log(`✅ API server listening on http://localhost:${port}`);
    
    // Smart cleanup job for expired pending tips (runs every 5 minutes, but only when active)
    const cleanupInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      const isIdle = timeSinceLastActivity > IDLE_THRESHOLD;
      
      if (!isIdle) {
        // Only run cleanup if there's been recent activity
        expireOldPendingTips().catch(err => {
          console.error('[cleanup] Error in expireOldPendingTips:', err);
        });
      } else if (process.env.NODE_ENV !== 'production') {
        console.log(`[cleanup] Skipping cleanup - idle for ${Math.round(timeSinceLastActivity / 60000)} minutes`);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // SSE connection monitoring (check every 10 minutes)
    const ENABLE_MONITOR_LOGS = (process.env.ENABLE_MONITOR_LOGS || '').toLowerCase() === 'true';
    const sseMonitorInterval = setInterval(() => {
      const activeConnections = activeSSEConnections.size;
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      const poolStats = getPoolStats();
      
      // Removed noisy monitor log
      
      // If no connections and idle for a while, we could optimize further
      if (activeConnections === 0 && timeSinceLastActivity > IDLE_THRESHOLD) {
        // Server is truly idle
        // Removed noisy monitor log
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    // Initial cleanup on startup
    setTimeout(() => {
      expireOldPendingTips().catch(err => {
        console.error('[cleanup] Error in initial expireOldPendingTips:', err);
      });
    }, 10000); // 10 seconds after startup
    
    // Cleanup on shutdown
    const gracefulShutdown = async () => {
      console.log('\n🛑 Starting graceful shutdown...');
      
      // Clear intervals first
      clearInterval(cleanupInterval);
      clearInterval(sseMonitorInterval);
      
      // Close all SSE connections
      activeSSEConnections.clear();
      
      // Close database pool
      try {
        await closePool();
        console.log('✅ Database pool closed');
      } catch (err) {
        console.error('❌ Error closing database pool:', err);
      }
      
      // Close server
      server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  });
}

startServer(basePort);
