# TikCash Backend

Production-ready Node.js API using Express and PostgreSQL (Neon) for the TikCash app.

## Features
- Express API with secure defaults (helmet, CORS allowlist)
- PostgreSQL via Neon with SSL, pooled connections
- SQL migrations runner
- Zod request validation
- Atomic balance updates for tips and withdrawals

## Setup (Step-by-step)
1) Create a Neon database (https://neon.tech)
   - Create project → copy the connection string with `?sslmode=require`.
2) Configure environment
   - Copy `.env.example` to `.env` and set:
     - DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
     - CORS_ORIGINS=http://localhost:3000 (or your frontend URL)
   - JWT_SECRET=your-long-random-secret
   - PORT=5000 (optional)
3) Install dependencies
   - Windows CMD
     - `npm install`
4) Run migrations
   - `npm run migrate`
5) Start the API server
   - Dev: `npm run dev`
   - Prod: `npm start`

## Neon (PostgreSQL) Guide
- Create a project at neon.tech, create a database.
- Copy the connection string (psql) and ensure it ends with `?sslmode=require`.
- Paste into `.env` as DATABASE_URL.

## API
- GET /health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/creators?sort=-total_earnings&category=food&search=ama
- POST /api/creators
- PATCH /api/creators/:id
- GET /api/creators/:id
- GET /api/creators/:id/transactions?limit=50
- POST /api/transactions

## Mapping Frontend Calls
- `Creator.list()` -> GET /api/creators
- `Creator.filter({ created_by })` -> GET /api/creators?search=... (or add dedicated query)
- `Creator.create(data)` -> POST /api/creators
- `Creator.update(id, patch)` -> PATCH /api/creators/:id
- `Transaction.filter({ creator_id })` -> GET /api/creators/:id/transactions
- `Transaction.create(data)` -> POST /api/transactions

Notes:
- Amounts are NUMERIC(14,2) in GHS.
- Add auth and payment provider integration for production.

## Paystack Integration (Initial)

Environment variables to add to `.env` (test mode first):

```
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxx
# Comma separated; leave blank to allow all during local dev
CORS_ORIGINS=http://localhost:3000
```

New endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/payments/paystack/initiate | Get Paystack authorization_url for a tip |
| POST | /api/paystack/webhook | Receive Paystack events (charge.success) |

Initiate request body:
```
{ "creator_id":"UUID", "amount": 5.00, "supporter_name":"Ama", "message":"Love your content", "supporter_email":"ama@example.com" }
```
Response:
```
{ "authorization_url":"https://checkout.paystack.com/...", "reference":"TIP_...", "access_code":"..." }
```

Webhook handling:
- Verifies signature using `x-paystack-signature`.
- On `charge.success`, inserts a completed `tip` transaction if the reference is new and updates balances.

Frontend flow:
1. Call initiate endpoint -> open `authorization_url` in a new window or redirect.
2. After payment, Paystack redirects back (you can supply a `callback_url` later) OR rely on webhook to update balance then poll creator transactions.

Next improvements to add:
- Persist a pending transaction before redirect for better audit trail.
- Add idempotency lock on webhook (currently checks by reference only).
- Handle failed events (`charge.failed`).
- Support automated withdrawals (Paystack Transfers) later.

