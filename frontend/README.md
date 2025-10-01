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

## Deploy (Netlify + Northflank)
Backend (Northflank): deploy the backend folder. Expose HTTPS base URL like `https://api-yourproject.northflank.app`.

Frontend (Netlify):
1. Add `netlify.toml` (already included) and replace `YOUR-NORTHFLANK-BACKEND-URL` with the real backend host.
2. Option A (preferred): Leave `VITE_API_URL` empty in Netlify build environment so runtime uses Netlify redirect rules (`/api/* -> backend`).
3. Option B: Set `VITE_API_URL=https://api-yourproject.northflank.app` if you want absolute calls (then you can remove the redirect rules for /api).
4. Build command: `npm run build` (Netlify auto-detects).
5. Publish directory: `dist`.

## Configuration
Central helper: `src/config.js` exports `API_BASE` derived from `VITE_API_URL` (or injected `window.__API_BASE__`).

Most code still uses relative paths (`/api/...`) so Netlify redirects handle it in production. If you need an absolute URL somewhere, import `API_BASE`.

## Environment Variables (Frontend)
| Name | Purpose | Example |
|------|---------|---------|
| VITE_API_URL | Explicit backend base (optional in production if using redirects) | https://api.example.com |

## Updating Share Links
`ShareLinkBar.jsx` now respects `window.__PUBLIC_APP_URL` if you inject it (e.g. via a small script tag in `index.html`). Otherwise it uses current origin.

Example injection (optional) in `index.html` head:
```html
<script>window.__PUBLIC_APP_URL=window.location.origin;</script>
```

## Production Checklist (Frontend)
- Use HTTPS domain (custom domain on Netlify).
- Confirm `/api/*` requests return 200 via redirect to backend.
- Set caching headers (Netlify handles static files automatically).
- Ensure backend CORS includes your Netlify + custom domains.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| 404 on /api calls in prod | Check `netlify.toml` rewrite & correct backend URL |
| Mixed content warnings | Use HTTPS for both frontend and backend URLs |
| Wrong callback after Paystack | Ensure `PUBLIC_APP_URL` in backend `.env` matches deployed frontend origin |

