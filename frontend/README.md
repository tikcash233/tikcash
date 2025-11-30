# TikCash Frontend

Simple React + Vite + Tailwind UI for TikCash.

## Quick Start (Development)
1. Copy `.env.example` to `.env`.
2. Set `VITE_API_URL=http://localhost:5000` (backend dev port).
3. Install deps: `npm install`.
4. Run dev: `npm run dev` → http://localhost:3000

During dev the Vite proxy in `vite.config.js` forwards `/api/*` to `http://localhost:5000` so relative fetch calls work.

## Build
`npm run build` outputs static assets to `dist/`.

## Deploy (Render)
Backend (Render web service):
1. Create a Web Service from the `backend/` folder (Node 20 runtime).
2. Build command: `npm install`. Start command: `npm start`.
3. Add the env vars listed in `backend/.env.example` and run `npm run migrate` once (Deploy → Shell → `npm run migrate`).

Frontend (Render static site):
1. Connect the repo and select the `render.yaml` file **or** point the site to the `frontend/` folder manually.
2. Build command: `npm install && npm run build`.
3. Publish directory: `dist`.
4. Add `VITE_API_URL=https://tikcash.onrender.com` (or your backend URL) in the Static Site → Environment tab.
5. Ensure a catch-all rewrite `/* -> /index.html` is configured (already provided in `render.yaml`).

## Configuration
Central helper: `src/config.js` exports `API_BASE` derived from `VITE_API_URL` (or injected `window.__API_BASE__`).

Most code still uses relative paths (`/api/...`). On Render we set `VITE_API_URL` to your backend host so the app automatically makes absolute calls. If you need the base elsewhere, import `API_BASE`.

## Environment Variables (Frontend)
| Name | Purpose | Example |
|------|---------|---------|
| VITE_API_URL | Explicit backend base (optional in production if using redirects) | https://api.example.com |

### How to set VITE_API_URL

- Render UI: Static Site → Environment → add `VITE_API_URL` with value `https://tikcash.onrender.com` (or your backend) and redeploy.
- Locally: Create a `.env` file in `frontend/` (copy `.env.example`) and set `VITE_API_URL=http://localhost:5000` for development.
- Override at runtime: You can also inject `window.__API_BASE__` via a small inline script in `index.html` before the app bundle loads if you need dynamic runtime configuration.

## Updating Share Links
`ShareLinkBar.jsx` now respects `window.__PUBLIC_APP_URL` if you inject it (e.g. via a small script tag in `index.html`). Otherwise it uses current origin.

Example injection (optional) in `index.html` head:
```html
<script>window.__PUBLIC_APP_URL=window.location.origin;</script>
```

## Printable QR Codes
Creators get a scannable QR inside the dashboard share card. It encodes the public share link and can be downloaded as a PNG for printing. The QR is generated client-side via the [`qrcode`](https://www.npmjs.com/package/qrcode) package, so make sure `npm install` runs after pulling this change.

## Production Checklist (Frontend)
- Use HTTPS domain (custom domain on Render).
- Confirm `/api/*` requests hit your backend by inspecting the Network tab.
- Set caching headers (Render handles static files automatically).
- Ensure backend CORS includes your Render + custom domains.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| 404 on /api calls in prod | Verify `VITE_API_URL` is set on the Render static site |
| Mixed content warnings | Use HTTPS for both frontend and backend URLs |
| Wrong callback after Paystack | Ensure `PUBLIC_APP_URL` in backend `.env` matches deployed frontend origin |

