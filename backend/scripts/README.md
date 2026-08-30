# 🗄️ Database Migrations & Data Ingestion Guide

This document defines the **exact execution order** for seeding, migrating, and verifying real property, locality, transit, and lifestyle datasets in MongoDB.

---

## 📋 Prerequisites

Ensure MongoDB and Redis services are running locally before executing migration scripts:

```bash
# Verify MongoDB (default port 27017)
mongosh "mongodb://localhost:27017/relocation_ai" --eval "db.stats()"

# Verify Redis (default port 6379)
redis-cli ping
```

---

## 🚀 Migration Execution Order

Run the following commands sequentially from the `backend/` directory:

```bash
cd backend
```

### Step 1: Import & Normalize Real Multi-City Property Listings
Ingests and normalizes real scraped rental listings from `datasetJson/` into city-specific MongoDB collections (`properties_kolkata`, `properties_bangalore`, `properties_pune`, `properties_mumbai`) as well as the aggregated `properties` collection.

```bash
npm run import-dataset
# Alternatively: npx tsx scripts/importMagicBricksDataset.ts
```

- **Input Source**: `datasetJson/magicbricks_kolkata.json`, `datasetJson/magicbricks_bangalore.json`, `datasetJson/magicbricks_pune.json`, `datasetJson/magicbricks_mumbai.json`
- **Actions Performed**:
  - Parses and standardizes rental prices, deposits, square footage, furnishing, and amenities.
  - Normalizes geographic coordinates (`[longitude, latitude]`) with geospatial indexes.
  - Attaches direct outbound provider listing URLs (`listing_url`, `source_url`, `provider_url`).
  - Computes deterministic SHA-1 deduplication keys to prevent duplicate entries.
- **Expected Output**:
  ```json
  {
    "files_processed": 4,
    "records_seen": 715,
    "records_normalized": 715,
    "records_upserted_city": 715
  }
  ```

---

### Step 2: Seed Localities with Metro Lines, Bus Routes & Lifestyle Hubs
Populates the `localities` collection with real intelligence scores (liveability, night safety, power stability, water quality), median rental benchmarks, and connects each locality to real transit corridors and lifestyle venues.

```bash
npx tsx scripts/seedAllLocalitiesAndExportRealData.ts
```

- **Target Collection**: `localities`
- **Actions Performed**:
  - Seeds 13 major IT/residential localities across Kolkata (Sector V, New Town, Lake Town, Baguiati, Kasba), Bangalore (Indiranagar, Koramangala, Bellandur, E-City), Pune (Hinjawadi, Baner), and Mumbai (BKC, Andheri West).
  - Embeds real **Metro Lines & Stations** (Kolkata Blue/Green/Orange Lines, Namma Metro Purple/Yellow Lines, Mumbai Aqua Line 3, Pune Line 3).
  - Embeds real **Bus Routes** (WBTC AC-12/AC-43, BMTC Vajra 500-D/335-E, BEST AS-524, PMPML 100-IT).
  - Embeds verified **Specialty Cafes** (Blue Tokai, Third Wave, Subko, Roastery) and **Craft Breweries/Clubs** (The GRID, Toit, Byg Brewski, Refinery 091, Effingut).
- **Expected Output**:
  ```
  Upserting comprehensive real localities into MongoDB with full Metro, Bus, Cafe & Club data...
  Upserted 13 localities with full transit and lifestyle datasets.
  Fetched 3393 real active properties from MongoDB.
  ```

---

### Step 3: Run Integration Test Suite & Endpoint Validation
Runs the automated 26-endpoint integration test suite to verify data integrity, proximity sorting, commute matrices, diurnal traffic models, and AI search responses.

```bash
npm test
# Alternatively: npx tsx scripts/testEndpoints.ts
```

- **Validation Checklist**:
  - `GET /health` (Status ok)
  - `GET /api/v1/localities` & `GET /api/v1/localities/:id`
  - `POST /api/v1/localities/compare` (Head-to-Head Locality Comparison)
  - `GET /api/v1/transit/metro` (All Metro Lines & Stations)
  - `GET /api/v1/transit/bus` (Real Bus Transit Corridors)
  - `GET /api/v1/transit/lifestyle` (Cafes, Specialty Roasters & Clubs)
  - `POST /api/v1/transit/hubs` (Nearest Transit & Lifestyle Hubs by GPS)
  - `GET /api/v1/properties` & `GET /api/v1/properties/:id`
  - `POST /api/v1/commute/estimate` & `POST /api/v1/commute/traffic` (24h Diurnal Traffic & Micro-Transit Shuttles)
  - `POST /api/v1/search` (AI Natural Language Search with Cache Hit)
  - `POST /api/v1/assistant/chat` (AI Advisor Chat Stream)
- **Expected Output**:
  ```
  Total: 26 | Passed: 26 | Failed: 0
  ✨ ALL TESTS PASSED SUCCESSFULLY! ✨
  ```

---

## 🔄 Optional / Maintenance Scripts

### Live Scraper for Housing.com (Headless Playwright)
Automated multi-locality scraper for live incremental ingestion.
```bash
npm run scrape-housing
# Alternatively: npx tsx scripts/populatePropertyData.ts
```

### Recommendation Benchmark Suite
Tests scoring weights, hard constraint filters, and latency benchmarking.
```bash
npm run test:bench
# Alternatively: npx tsx scripts/testRecommendationEngine.ts
```

---

## 🛠️ Complete One-Liner Execution

To run the entire migration sequence in one command:

```bash
cd backend && npm run import-dataset && npx tsx scripts/seedAllLocalitiesAndExportRealData.ts && npm test
```
