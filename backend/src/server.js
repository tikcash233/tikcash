import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { z } from 'zod';
import { CreatorCreateSchema, CreatorUpdateSchema, TransactionCreateSchema } from './schemas.js';
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
      "/api/creators": {
        get: { summary: "List creators", parameters: [], responses: { "200": { description: "List" } } },
        post: { summary: "Create creator", requestBody: {}, responses: { "201": { description: "Created" } } }
      },
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
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`✅ API server listening on http://localhost:${port}`);
});
