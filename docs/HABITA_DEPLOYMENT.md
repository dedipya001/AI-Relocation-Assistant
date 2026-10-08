# Habita AI frontend + backend deployment

## Unified navigation
- Landing page: `/`, with `/landing` retained as an alias.
- Existing interactive dashboard: `/app`.
- Existing routes: `/search`, `/assistant`, `/compare`, `/locality/[id]`, `/property/[id]`, `/shortlist` etc.
- Marketing launch buttons now point to `/app`; shared application navigation links back to the landing page.

## Separate Vercel projects
1. `habita-ai`: **Next.js** frontend from repository root directory `frontend`. Its public production URL is `https://habita-ai.vercel.app`.
2. `ai-relocation-assistant`: existing **Express** backend from `backend`. Do not point browser landing pages at this project.
3. The Next.js rewrite in `frontend/next.config.mjs` proxies `/api/v1/*` to `BACKEND_URL`. The browser should use same-origin `/api/v1` via `NEXT_PUBLIC_API_URL`. Never ship localhost URLs for production APIs.

## Backend requires external services
Vercel serverless does not run a MongoDB instance at `127.0.0.1:27017`. At the time of this change, calling `/api/v1/localities` returned HTTP 500 and `connect ECONNREFUSED 127.0.0.1:27017`. Set the actual **backend** environment database connection string to an existing reachable managed MongoDB deployment, verify network access, and redeploy backend. Redis-backed functionality may also require external Redis.

Do not put database credentials in Git. Frontend includes demo property/search/locality fallbacks, but this does **not** restore authentication, persistence, AI assistant, or other live API functionality.

## Validation
1. Run `npm --prefix frontend run typecheck && npm --prefix frontend run build`.
2. Verify `/`, `/app`, `/search`, `/assistant`, `/compare` return pages.
3. Exercise the full user journey: landing → Explore → search → map → compare → assistant.
4. Verify `/api/v1/localities` returns 200 before calling real-data features operational.
