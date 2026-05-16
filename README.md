# AI Relocation Intelligence

An AI-powered relocation intelligence platform that answers: **Where should I actually live for a better life near my office?**

The product combines natural-language search, locality intelligence, aggregated rental listings, commute analysis, actual rent feedback, safety signals, internet reliability, and AI recommendations.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style UI primitives, Zustand, Framer Motion, Mapbox-ready map layer
- Backend: FastAPI, MongoDB, Motor, Redis, Celery
- AI: OpenAI API, RAG-ready locality summaries, recommendation engine
- Infrastructure: local environment-based config

## Current Foundation

- Monorepo scaffold with `frontend/`, `backend/`, `docs/`
- Typed MongoDB/Pydantic schemas for properties, localities, commute, feedback, AI summaries
- API routes for search, properties, localities, commute, feedback, assistant
- Seed data for Sector V, New Town, and Lake Town
- Next.js pages for landing, search, assistant, compare, property detail, locality detail

## Run Locally

Prerequisites for non-Docker mode:

- MongoDB running on localhost:27017
- Redis running on localhost:6379

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

## Housing.com Ingestion Script

Populate MongoDB listings using Playwright network interception (JSON API responses):

```bash
python backend/scripts/populatePropertyData.py --city "Kolkata"
```

Useful flags:

- `--search-url "https://housing.com/in/rent/kolkata"` (repeatable)
- `--search-url "https://housing.com/in/rent/kolkata?page={page}" --max-pages 5`
- `--headful` for debugging browser behavior
- `--dry-run` to validate extraction without writing to MongoDB
- `--no-deactivate-stale` to skip stale listing deactivation
- `--storage-state backend/scripts/housing_storage_state.json` to reuse a trusted browser session

If Housing serves a security/bot challenge, capture storage state once:

```bash
python backend/scripts/capture_housing_storage_state.py --output backend/scripts/housing_storage_state.json
python backend/scripts/populatePropertyData.py --city "Kolkata" --storage-state backend/scripts/housing_storage_state.json
```

Cron example (Linux):

```bash
0 */6 * * * cd /path/to/repo && /path/to/python backend/scripts/populatePropertyData.py --city "Kolkata" >> /var/log/housing_ingest.log 2>&1
```

Windows Task Scheduler action example:

```text
Program/script: C:\path\to\python.exe
Add arguments: backend\scripts\populatePropertyData.py --city "Kolkata"
Start in: C:\path\to\AI relocation Assistant
```

## Environment

Copy the example files and fill keys as needed:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
```

Note:

- `backend/.env.example` is configured for local services (`localhost`).

Important keys:

- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

The local frontend env already includes the Mapbox public token provided for development.

## Free/Open APIs Used First

- Mapbox GL JS for the interactive property map.
- OpenStreetMap Nominatim for India locality geocoding.
- OpenStreetMap Overpass API for early hostel/residential/apartment map leads.
- MagicBricks, 99acres, NoBroker, and Broker CRM adapters for the listings layer.
- Apify, BrightData, scheduled Playwright, and partner feed hooks for ingestion.

See [docs/API_PROVIDERS.md](docs/API_PROVIDERS.md) for provider notes and caveats.

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
