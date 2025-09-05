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
