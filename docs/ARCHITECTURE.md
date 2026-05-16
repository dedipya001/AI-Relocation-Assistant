# AI Relocation Intelligence Architecture

## 1. Full Project Folder Structure

```text
.
├── frontend/                 # Next.js App Router, React, TypeScript, Tailwind
│   ├── app/                  # Routes: landing, search, assistant, compare, details
│   ├── components/           # UI, map, search, property, locality, assistant modules
│   ├── lib/                  # API client and utilities
│   ├── store/                # Zustand client state
│   └── types/                # Shared frontend contracts
├── backend/                  # FastAPI service
│   ├── app/api/v1/           # Versioned routers
│   ├── app/ai/               # OpenAI client and RAG orchestration
│   ├── app/core/             # Settings and logging
│   ├── app/db/               # MongoDB and Redis clients
│   ├── app/models/           # Pydantic schemas
│   ├── app/repositories/     # Data access
│   ├── app/services/         # Intent, commute, price, recommendation logic
│   ├── app/scraping/         # Adapter-based ingestion pipeline
│   ├── app/workers/          # Celery background tasks
│   └── scripts/              # Seed and maintenance scripts
├── docs/                     # Architecture notes
└── .env.example
```

## 2. Frontend Architecture

- `app/` uses the Next.js App Router with route-level pages.
- `components/ui/` contains shadcn-compatible primitives.
- `components/map/relocation-map.tsx` uses Mapbox when a token exists and a stable map-like fallback otherwise.
- `store/search-store.ts` owns AI prompt search state with Zustand.
- `lib/api.ts` centralizes typed calls to FastAPI.

## 3. Backend Architecture

- Routers stay thin and delegate to services.
- Repositories isolate MongoDB collection access.
- Services implement intent parsing, lowest price detection, commute estimates, and scoring.
- Celery handles scraping and AI summary refresh jobs.
- Redis is used for AI/search response caching, rate limiting, sessions, and future alert queues.

## 4. MongoDB Schema Definitions

Collections:

- `properties`: listing details, source platform, rent, price history, coordinates, locality, amenities, dedupe key.
- `localities`: city, slug, coordinates, AI summary, tags, essentials, things to do, scoring bundle.
- `commute_data`: origin entity, destination, mode estimates, monthly cost, reliability.
- `user_feedback`: anonymous locality/property feedback by category.
- `negotiated_rents`: actual rent, broker fee, maintenance, hidden costs.
- `reviews`: normalized review/social evidence for RAG.
- `internet_scores`: ISP, speed, outage, mobile signal observations.
- `safety_scores`: crime, lighting, night activity, women safety mentions.
- `ai_summaries`: cached AI summaries by entity.

## 5. Redis Caching Strategy

- `relocation:{env}:ai_search:{hash}` caches parsed query plus ranking for 5 minutes.
- `relocation:{env}:commute:{hash}` should cache commute API responses for 1-6 hours.
- `relocation:{env}:ai_summary:{entity}` caches generated locality summaries.
- `relocation:{env}:rate:{ip}` supports API throttling.
- `relocation:{env}:session:{id}` can store anonymous saved search/session context.

## 6. API Route Definitions

- `POST /api/v1/search`: natural-language search to intent, filters, recommendations, properties.
- `GET /api/v1/properties`: filtered listing search.
- `GET /api/v1/properties/{id}`: property detail with lowest price.
- `GET /api/v1/localities`: top localities.
- `GET /api/v1/localities/{id}`: locality intelligence detail.
- `POST /api/v1/commute/estimate`: route mode, time, cost, reliability estimates.
- `POST /api/v1/feedback/negotiated-rents`: anonymous actual rent submission.
- `POST /api/v1/feedback/locality`: locality signal feedback.
- `POST /api/v1/assistant/chat`: conversational relocation assistant.

## 7. AI Architecture

- Intent parsing extracts office location, budget, property type, commute modes, and lifestyle preferences.
- Retrieval stores locality reviews, discussion snippets, civic signals, commute data, safety data, and internet feedback.
- RAG summaries produce concise locality intelligence with explicit tradeoffs.
- Recommendation scoring combines affordability, commute, safety, internet, food access, and lifestyle fit.
- AI responses are cached in Redis to reduce cost and latency.

## 8. Initial Implementation Plan

1. Foundation architecture, typed schemas, API routes, UI shell.
2. Replace heuristic intent parsing with OpenAI structured outputs.
3. Add Google Maps/Mapbox commute adapters and cache responses.
4. Implement source adapters for authorized marketplace feeds and community submissions.
5. Add vector search for reviews and locality evidence.
6. Add negotiated rent analytics and fair-rent confidence intervals.
7. Add authentication, saved searches, alerts, and personalization.

## 9. Starter Boilerplate Code

The starter code is committed in `frontend/` and `backend/`. Run it locally with separate frontend/backend commands.

## 10. Local Setup

Run MongoDB and Redis locally, then run backend and frontend development servers.

## 11. Environment Variable Setup

Copy `.env.example`, `backend/.env.example`, and `frontend/.env.example` into real env files. Add OpenAI, Google Maps, and Mapbox keys when available.

## 12. Example Pages and Components

- Landing/search-first page: `frontend/app/page.tsx`
- Search workspace: `frontend/app/search/page.tsx`
- AI assistant: `frontend/app/assistant/page.tsx`
- Compare table: `frontend/app/compare/page.tsx`
- Property detail: `frontend/app/property/[id]/page.tsx`
- Locality detail: `frontend/app/locality/[id]/page.tsx`

## 13. Initial Database Seed Strategy

`backend/scripts/seed.py` seeds Kolkata localities, properties, price histories, and negotiated rent examples. Expand it with verified provider feeds and anonymized user submissions.

## 14. Scraper Architecture

The scraping layer is adapter-based:

- each source implements `PropertySourceAdapter.fetch`
- the pipeline normalizes, retries, deduplicates, and upserts
- production integrations should use official APIs, partner feeds, user-authorized group ingestion, or ToS-compliant scraping
- rotating proxies, rate limits, and robots/terms checks belong in each adapter

## 15. Recommendation Engine Logic

Current weights:

- affordability: 24%
- commute: 24%
- safety: 20%
- internet: 14%
- food access: 10%
- lifestyle fit: 8%

This gives the MVP sane defaults while leaving room for personalization and learned ranking later.
