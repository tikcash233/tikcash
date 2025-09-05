# TikCash Frontend

- Copy `.env.example` to `.env` and set `VITE_API_URL` to your backend URL (default http://localhost:8080).
- Start dev server normally: `npm run dev`.
- The app will call the backend API; if API is offline, it falls back to local storage.
