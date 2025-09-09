import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { z } from 'zod';
import { CreatorCreateSchema, CreatorUpdateSchema, TransactionCreateSchema, RegisterSchema, LoginSchema, RequestVerifySchema, VerifyCodeSchema, ResetWithPinSchema, ChangePasswordSchema } from './schemas.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { listCreators, createCreator, updateCreator, getCreatorById } from './models/creators.js';
import { listTransactionsForCreator, createTipAndApply, createTransaction, getTransactionByReference, completePendingTip } from './models/transactions.js';
import { initializePaystackTransaction } from './payments/paystack.js';
import crypto from 'node:crypto';
import http from 'http';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(compression());
// Capture raw body for Paystack webhook signature verification while still parsing JSON normally elsewhere
app.use((req, res, next) => {
  if (req.url.startsWith('/api/paystack/webhook')) {
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
  } catch (e) { next(e); }
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

// Paystack: initiate a tip payment (create a pending transaction now, later completed by webhook)
app.post('/api/payments/paystack/initiate', async (req, res, next) => {
  try {
    const { creator_id, amount, supporter_name, message, supporter_email } = req.body || {};
    if (!creator_id || typeof amount === 'undefined') return res.status(400).json({ error: 'creator_id and amount are required' });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: 'Amount must be > 0' });
    // Generate reference
    const reference = 'TIP_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    // Insert pending transaction with zero amount for now (will be updated to actual amount on complete)
    await createTransaction({
      creator_id,
      supporter_name: supporter_name || null,
      amount: amt, // store intended amount already
      message: message || null,
      transaction_type: 'tip',
      status: 'pending',
      payment_reference: reference,
    });
    const initData = await initializePaystackTransaction({
      amountGHS: amt,
      email: supporter_email || 'anon@example.com',
      reference,
  metadata: { creator_id, supporter_name, message },
  callbackUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:3000') + '/payment/result?ref=' + reference
    });
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
      return res.json({ reference: ref, status: updated.status, amount: Number(updated.amount) });
    }
    res.json({ reference: ref, status: tx.status });
  } catch (e) { next(e); }
});

// Paystack webhook endpoint
app.post('/api/paystack/webhook', async (req, res, next) => {
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
      const metadata = data?.metadata || {};
      const creator_id = metadata.creator_id;
      if (creator_id) {
        // Create transaction & update balances if not already inserted (idempotency by payment_reference)
        // Check if reference exists
        try {
          const existing = await pool.query('SELECT id FROM transactions WHERE payment_reference = $1 LIMIT 1', [data.reference]);
          if (existing.rowCount === 0) {
            await createTipAndApply({
              creator_id,
              supporter_name: metadata.supporter_name || data.customer?.email || 'Anonymous',
              amount: Number(data.amount) / 100, // convert pesewas to GHS
              message: metadata.message || null,
              transaction_type: 'tip',
              status: 'completed',
              payment_reference: data.reference,
            });
          }
        } catch (err) {
          console.error('Failed to persist Paystack tip', err);
        }
      }
    }
    res.json({ received: true });
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
  });
}

startServer(basePort);
