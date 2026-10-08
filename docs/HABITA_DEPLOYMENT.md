# Habita AI deployment: JSON-backed property data

## Site routes
- `/` — Habita AI landing page
- `/app` — interactive relocation dashboard
- `/search`, `/compare`, `/assistant` — existing product pages

## Read-only data (no MongoDB required)
The Next.js project **habita-ai** runs from the `frontend` root directory on Vercel. Its `/api/v1/properties`, `/api/v1/localities`, `/api/v1/search`, and `/api/v1/recommendations/*` endpoints read versioned JSON property snapshots included in `frontend/data`. They are copied from the repository's `datasetJson` snapshots for Kolkata, Bengaluru, Mumbai, and Pune.

No MongoDB or Redis connection is needed for those Next.js routes. The underlying data are **dated snapshots**, not guaranteed live listings. Some locality demo scores are bundled for demonstration; unknown scores should not be interpreted as measured or verified.

The older Express backend project is still separate. Routes for user accounts, user shortlist persistence, community submissions, and advanced conversational AI may continue to depend on that backend and its runtime services. These capabilities are **not** automatically converted to JSON-backed operation.

## Validate
Run `npm --prefix frontend run typecheck && npm --prefix frontend run build` and verify:
- GET `/api/v1/properties` returns a JSON array of properties
- GET `/api/v1/localities` returns a JSON array
- POST `/api/v1/search` with `{"query":"Kolkata budget 15000"}` returns ranked results
- Landing → `/app` → `/search` works

To refresh snapshot data, update the checked-in source JSON and synchronized `frontend/data` copies and redeploy; do not assume updates are automatic.
