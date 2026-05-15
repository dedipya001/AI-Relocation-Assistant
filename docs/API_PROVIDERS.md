# Property and Geo API Providers

## Listings Layer

The production property API is:

```text
GET /api/v1/properties/aggregate?place=Sector%20V%20Kolkata&sources=magicbricks&sources=99acres&sources=nobroker&sources=broker_crm
```

Source metadata:

```text
GET /api/v1/properties/aggregate/sources
```

Implemented listing adapters:

- MagicBricks: bulk listings.
- 99acres: builder and broker inventory.
- NoBroker: owner-listed rentals.
- Broker CRM feeds: fresh hyperlocal inventory.

Supported ingestion methods behind those adapters:

- partnerships/direct feeds
- Apify actors
- BrightData collectors/datasets
- scheduled Playwright scraping
- JSON/CSV broker CRM feed ingestion

Environment hooks:

- `APIFY_TOKEN`
- `APIFY_MAGICBRICKS_ACTOR_ID`
- `APIFY_99ACRES_ACTOR_ID`
- `APIFY_NOBROKER_ACTOR_ID`
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_MAGICBRICKS_DATASET_ID`
- `BRIGHTDATA_99ACRES_DATASET_ID`
- `BRIGHTDATA_NOBROKER_DATASET_ID`
- `BROKER_CRM_FEED_URL`

If these are not configured, the adapter returns normalized sample listings so the map and ranking UI can still be populated during development.

## Map Rendering

- Provider: Mapbox GL JS
- Use: interactive map, animated property markers, popups, navigation controls
- Key: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- Current local token: stored in `frontend/.env.local`

## Free/Open Data for MVP

- OpenStreetMap Overpass API
  - Use: discover mapped hostels, residential buildings, apartments, and dormitories near Indian office hubs.
  - Endpoint used by backend: `https://overpass-api.de/api/interpreter`
  - Backend service: `backend/app/services/open_property_data.py`

- OpenStreetMap Nominatim
  - Use: convert Indian locality names such as `Sector V Kolkata` into coordinates before querying Overpass.
  - Endpoint used by backend: `https://nominatim.openstreetmap.org/search`
  - Important: keep a descriptive `User-Agent` and avoid bulk geocoding on the public service.

## Property Data Reality

Most Indian rental marketplaces do not provide a broadly usable free public listings API. For production-quality rental data, the platform should combine:

- marketplace partnerships
- user-submitted listings
- local broker inventory uploads
- ToS-compliant scraping where permitted
- community sources such as Facebook/Telegram only with explicit authorization
- open OSM leads as discovery hints, not verified rent listings

The MVP now separates these concepts: OSM data can populate the map early, while verified rental listings remain normalized through the `properties` collection.

## Scheduled Real-Time Updates

Celery task hooks:

- `scrape.properties`
- `scrape.properties.daily`

Current schedule:

- daily property scrape for Kolkata

Expected flow:

1. Trigger Apify/BrightData/Playwright/partner feed per source.
2. Normalize into the shared `Property` schema.
3. Deduplicate by title, coordinates, source, and rent.
4. Enrich with Mapbox coordinates, RERA verification, commute, nearby essentials, and locality intelligence.
5. Upsert into MongoDB `properties`.
