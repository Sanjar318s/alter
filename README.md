# ALTER

Cosplay community platform — Next.js frontend + Express API.

## Structure

- `frontend/` — Next.js app (deploy to Cloudflare Pages)
- `backend/` — Express API + SQLite (dev); PostgreSQL for production

## Local dev

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Cloudflare Pages

- **Root directory:** `frontend`
- **Build command:** `npm ci && npm run build`
- **Environment:** set `ALTER_API_ORIGIN` / `NEXT_PUBLIC_API_URL` to your API URL
