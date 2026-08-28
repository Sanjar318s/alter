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

## Deploy (Vercel / Cloudflare Pages)

- **Root directory:** `frontend`
- **Build command:** `npm ci && npm run build`
- **Environment:**
  - `NEXT_PUBLIC_SITE_URL=https://altercosplay.vercel.app` (SEO / canonical / sitemap)
  - `ALTER_API_ORIGIN` / `NEXT_PUBLIC_API_URL` → your API URL

## YouTube Shorts (brand auto-publish)

1. **Google Cloud:** OAuth Web client + YouTube Data API v3. Redirect URI:  
   `https://<api-host>/api/admin/social/youtube/callback`
2. **Fly secrets** (API + `social` worker process):
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
   - `GEMINI_API_KEY` (moderation before publish)
   - `SOCIAL_PUBLISH_PLATFORMS=youtube` (default; add `tiktok` later)
   - `fly scale count social=1` on the API app
3. **Owner:** Admin → «Подключить YouTube» → approve reels in review queue.

See `backend/.env.example` for the full list.
