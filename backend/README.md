# TikCash Backend

Production-ready Node.js API using Express and PostgreSQL (Neon) for the TikCash app with Backblaze B2 for creator profile assets.

## Features
- Express API with secure defaults (helmet, CORS allowlist)
- PostgreSQL via Neon with SSL, pooled connections
- SQL migrations runner
- Zod request validation
- Atomic balance updates for tips and withdrawals
- Backblaze B2 (S3-compatible) uploads for creator profile images

## Setup (Step-by-step)
1) Create a Postgres DB (Neon recommended – https://neon.tech)
   - Copy the connection string, be sure it ends with `?sslmode=require` for TLS.
2) Environment variables
   - Copy `.env.example` to `.env`.
   - Fill in: `DATABASE_URL`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PUBLIC_APP_URL`.
   - Configure Backblaze credentials: `BACKBLAZE_KEY_ID`, `BACKBLAZE_APPLICATION_KEY`, `BACKBLAZE_REGION`, `BACKBLAZE_BUCKET_NAME` (defaults to `tikcashprofilepictures`). Optional: `BACKBLAZE_ENDPOINT`, `BACKBLAZE_PUBLIC_BASE_URL`.
   - Add your local / deployed frontend domains to `CORS_ORIGINS` (comma separated).
3) Install dependencies
   - `npm install`
4) Run migrations once
   - `npm run migrate`
5) Start the API server
   - Dev: `npm run dev`
   - Prod: `npm start`

If something fails to start, re-check your `.env` values and logs. (The previous temporary debug endpoint was removed for security.)

### New Health Endpoints
| Path | Purpose |
|------|---------|
| `/health` | Full health (DB check) |
| `/healthz` | Liveness (fast, always OK if process running) |
| `/readyz` | Readiness (returns 500 if DB not reachable) |

Platforms like Northflank / Kubernetes often poll `/readyz` to know when to send traffic.

### Config Module
`src/config.js` centralises env parsing + simple validation. It supplies defaults for dev only and will throw in production if required values are missing (fast fail instead of half‑broken runtime).

Key exported values: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `PUBLIC_APP_URL`, `CORS_ORIGINS`.

### Backblaze B2 Storage
- Profile picture uploads now go to Backblaze B2 using the S3-compatible API (Supabase storage is no longer used and previously uploaded images are not migrated).
- Required env vars: `BACKBLAZE_KEY_ID`, `BACKBLAZE_APPLICATION_KEY`, `BACKBLAZE_REGION`, `BACKBLAZE_BUCKET_NAME` (bucket `tikcashprofilepictures` is used in production).
- Optional overrides:
   - `BACKBLAZE_ENDPOINT`: custom S3 endpoint URL if you prefer a vanity domain or region alias.
   - `BACKBLAZE_PUBLIC_BASE_URL`: if you serve the bucket via CDN or custom domain, set this so returned profile URLs use that host.
- Files are stored under `<userId>/<creator_X_timestamp.ext>` allowing per-user cleanup.
- Deleting a profile picture removes the object from Backblaze and nulls the DB column.

### Minimal Mental Model
- Put secrets in environment variables.
- Migrations run once at deploy time.
- App starts → `/readyz` OK → traffic flows.
- Frontend hits only `/api/...` routes (Netlify rewrite points them at backend).

### Northflank Deployment (Backend)
1. Create a new service (Node 18+ runtime).
2. Point to your Git repo / branch.
3. Set build command: none (plain Node). Start command: `npm start`.
4. Add environment variables (use the same names as in `.env.example`).
5. Expose port 5000 (HTTP). Northflank will assign a public HTTPS URL.
6. Add that URL to your `CORS_ORIGINS` (e.g. `https://your-svc--username.code.run`) and redeploy.
7. (Optional) Create a job that runs `npm run migrate` before main deploy OR run it manually via a one‑off task.

### Netlify Deployment (Frontend)
1. In the frontend folder: ensure `netlify.toml` exists at repo root (**we placed it at project root**). If Netlify expects it at root, you are good.
2. Build command: `npm run build` inside `frontend` directory (set base directory to `frontend`).
3. Publish directory: `frontend/dist`.
4. Environment var `VITE_API_URL` can be blank if you rely on Netlify proxy redirects; otherwise set it to your backend HTTPS URL.
5. Update `netlify.toml` replacing `YOUR-NORTHFLANK-BACKEND-URL` with the actual backend URL.

### Local Dev vs Production
| Concern | Development | Production |
|---------|------------|------------|
| API base | `http://localhost:5000` | Northflank URL (proxied from Netlify) |
| CORS | Allows localhost automatically + list | Only allow listed domains |
| JWT secret | Dev fallback if missing | MUST be set (app exits if missing) |
| Rate limiting | Disabled | Enabled (basic global) |
| Logging | Verbose warnings | Quieter (errors + important) |

### Migration Command
`npm run migrate` runs all missing SQL files in `src/migrations` once. It records applied file names in `_migrations` table. Safe to run repeatedly (idempotent). Run this during deploy or via a pre-start step.

### Tips for Secrets
- Generate JWT secret: `openssl rand -hex 32`.
- Never commit your `.env`.
- Use platform secret management (Northflank: Project → Variables).

### Paystack Callback URL
Server constructs callback as: `PUBLIC_APP_URL + '/payment/result?ref=...'`.
So ensure `PUBLIC_APP_URL` matches your Netlify site domain (e.g. `https://your-site.netlify.app` or custom domain).

### Common Issues
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 everywhere | JWT not stored or missing Authorization header | Check localStorage token after login |
| CORS error | Domain not in `CORS_ORIGINS` | Add domain & redeploy backend |
| Payments never complete | Webhook not configured / signature fail | Set Paystack webhook to `/api/paystack/webhook` (HTTPS) |
| Callback page stuck on pending | Webhook not received & verify attempts exhausted | Manually click Verify; check webhook logs |

### Quiet Mode (Logs)
Set `ENABLE_DB_LOGS=false`, `ENABLE_MONITOR_LOGS=false`, `ENABLE_CLEANUP_LOGS=false` (defaults already quiet). Enable selectively when debugging.

---
The rest of this document (below) is the original reference section.

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
# Base URL where frontend is served (used for callback_url)
PUBLIC_APP_URL=http://localhost:3000
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

### callback_url vs manual redirect
We now send `callback_url` to Paystack so after payment they redirect the user directly to `/payment/result?ref=REFERENCE`. No client-side query hack needed.

### Webhooks
1. Start tunnel: `ngrok http 5000` (or any similar tool).
2. Set webhook URL in Paystack Test dashboard to: `https://YOUR_TUNNEL/api/paystack/webhook`.
3. Make payment. Webhook will mark transaction completed; the result page polling stops once status=completed.

### Real-time updates (SSE)
Endpoint: `GET /api/stream/transactions`

This is a Server-Sent Events stream. The backend pushes lines like:
```
event: tx
data: {"type":"transaction.update","reference":"TIP_xxx","status":"completed","creator_id":"...","amount":5.00,"at":"2025-09-09T12:00:00Z"}
```
How to consume in the browser:
```js
const ev = new EventSource('/api/stream/transactions');
ev.addEventListener('tx', (e) => {
   const data = JSON.parse(e.data);
   // If you're on a payment result page with matching reference, update UI instantly
   if (data.reference === currentRef) {
      setStatus(data.status);
   }
   // Or refresh a creator's earnings list
});
```
SSE vs Polling:
- Polling = client asks repeatedly (wastes requests when nothing changed).
- SSE = server pushes changes immediately over one long-lived HTTP connection.

Production note: behind Nginx/Cloudflare ensure response buffering is disabled for the `/api/stream/transactions` path so events flush promptly.

### Production Readiness Checklist (Recap)
| Item | Done? | Notes |
|------|-------|-------|
| NODE_ENV=production |  | Set in platform env vars |
| Strong JWT_SECRET |  | 32+ random hex chars |
| DATABASE_URL points to prod DB |  | Ends with sslmode=require |
| PUBLIC_APP_URL set |  | Exact HTTPS origin of frontend |
| CORS_ORIGINS limited |  | Only your real domains |
| Paystack live keys installed |  | Switch from test to live before launch |
| Webhook URL live & verified |  | /api/paystack/webhook returns 200 quickly |
| Migrations run on deploy |  | `npm run migrate` succeeded |
| Rate limit tuned |  | Adjust window & max if needed |
| Backups / PITR plan |  | Neon branch or PITR configured |
| Debug endpoint removed |  | N/A (not included in production build) |

Tick each line before inviting real users.

### Verbose Log Control (Development Helpers)
Two optional environment variables let you silence periodic console output in development:

```
# Disable noisy monitor/cleanup logs (default: both false)
ENABLE_MONITOR_LOGS=false
ENABLE_CLEANUP_LOGS=false
```

- `ENABLE_MONITOR_LOGS=true` shows 10‑minute interval SSE / DB pool stats like:
   `[Monitor] SSE: 1, Activity: 0m ago, DB Pool: 1/1/0 (total/idle/waiting)`
- `ENABLE_CLEANUP_LOGS=true` shows cleanup summaries when old pending tips are expired:
   `[cleanup] Expired 2 old pending tips`


Additionally, you can silence all database-related logs (connection errors, retries, query failures) with:

```
ENABLE_DB_LOGS=false
```

Set to `true` to see all DB logs (default: false). Critical errors will still throw and show up as API errors, but the console will be much quieter.

Leave all three flags `false` for minimal output.

### Simple definition of SSE
Server-Sent Events (SSE) = a single always-open HTTP connection where the server can keep sending small text messages to the browser as things happen. Browser listens; no need to keep asking.

---
## Changelog (Recent Enhancements)
- Added `src/config.js` central config & validation.
- Added `/healthz` and `/readyz` endpoints.
<!-- Removed debug endpoint before production -->
- Added `.env.example` with required + optional vars.
- Added `netlify.toml` with API proxy redirects.
- Trust proxy enabled for production reverse proxy correctness.

<!-- Debug endpoint already removed to keep surface minimal -->

