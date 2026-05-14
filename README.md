# AI Relocation Intelligence

An AI-powered relocation intelligence platform that answers: **Where should I actually live for a better life near my office?**

The product combines natural-language search, locality intelligence, aggregated rental listings, commute analysis, actual rent feedback, safety signals, internet reliability, and AI recommendations.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style UI primitives, Zustand, Framer Motion, Mapbox-ready map layer
- Backend: FastAPI, MongoDB, Motor, Redis, Celery
- AI: OpenAI API, RAG-ready locality summaries, recommendation engine
- Infrastructure: Docker, Docker Compose, environment-based config

## Current Foundation

- Monorepo scaffold with `frontend/`, `backend/`, `docs/`
- Typed MongoDB/Pydantic schemas for properties, localities, commute, feedback, AI summaries
- API routes for search, properties, localities, commute, feedback, assistant
- Seed data for Sector V, New Town, and Lake Town
- Next.js pages for landing, search, assistant, compare, property detail, locality detail
- Docker Compose for MongoDB, Redis, API, worker, frontend

## Run With Docker

```bash
docker compose up --build
```

Seed the database:

```bash
docker compose exec backend python scripts/seed.py
```

Open:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Run Locally

Backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Environment

Copy the example files and fill keys as needed:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
```

Important keys:

- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

## MVP Phases

Phase 1:
- property aggregation
- AI prompt search
- locality summaries
- commute estimation

Phase 2:
- negotiated rent crowdsourcing
- safety scoring
- internet scoring
- recommendation engine improvements

Phase 3:
- conversational assistant depth
- personalization
- saved searches
- alerts

Phase 4:
- community features
- roommate matching
- relocation marketplace
