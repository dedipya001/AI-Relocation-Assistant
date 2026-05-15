import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

ROOT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import settings
from app.models.common import SourcePlatform

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@dataclass
class ImportStats:
    files_processed: int = 0
    records_seen: int = 0
    records_normalized: int = 0
    records_skipped: int = 0
    records_upserted_city: int = 0
    records_upserted_default: int = 0
    stale_marked: int = 0
    geocode_cache_hits: int = 0
    geocode_api_calls: int = 0


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "unknown"


def city_collection_name(city: str) -> str:
    return f"properties_{slugify(city).replace('-', '_')}"


def stable_locality_id(city: str, locality: str) -> str:
    place = f"{city} {locality}".strip()
    slug = slugify(place)
    digest = hashlib.sha1(place.encode("utf-8")).hexdigest()[:6]
    return f"listing-{slug}-{digest}"


def fallback_city_coordinates(city: str) -> tuple[float, float]:
    text = city.lower()
    if "kolkata" in text:
        return 88.4335, 22.5762
    if "bangalore" in text or "bengaluru" in text:
        return 77.5946, 12.9716
    if "mumbai" in text:
        return 72.8777, 19.076
    if "delhi" in text or "gurgaon" in text or "gurugram" in text:
        return 77.1025, 28.7041
    if "pune" in text:
        return 73.8567, 18.5204
    if "hyderabad" in text:
        return 78.4867, 17.385
    if "chennai" in text:
        return 80.2707, 13.0827
    if "ahmedabad" in text:
        return 72.5714, 23.0225
    return 77.2090, 28.6139


def parse_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        digits = re.sub(r"[^0-9]", "", value)
        if not digits:
            return None
        return int(digits)
    return None


def normalize_property_type(value: Any, title: str) -> str:
    text = f"{value or ''} {title}".lower()
    if "pg" in text or "paying guest" in text:
        return "PG"
    if "hostel" in text:
        return "hostel"
    if "studio" in text or "1rk" in text:
        return "studio"
    if "room" in text or "shared" in text:
        return "shared flat"
    return "apartment"


def build_dedupe_key(title: str, rent: int, locality_id: str, source_url: str | None) -> str:
    stable = f"{SourcePlatform.magicbricks.value}:{title}:{rent}:{locality_id}:{source_url or ''}"
    return hashlib.sha1(stable.encode("utf-8")).hexdigest()


class LocalityGeocoder:
    def __init__(self, db: AsyncIOMotorDatabase, *, dry_run: bool) -> None:
        self.db = db
        self.collection: AsyncIOMotorCollection = db.geocode_cache
        self.dry_run = dry_run
        self.memory_cache: dict[str, tuple[float, float]] = {}
        self.last_call_ts = 0.0

    async def resolve(self, city: str, locality: str, stats: ImportStats) -> tuple[float, float, str]:
        key = f"nominatim:{slugify(city)}:{slugify(locality)}"
        if key in self.memory_cache:
            stats.geocode_cache_hits += 1
            lon, lat = self.memory_cache[key]
            return lon, lat, "cache-memory"

        cached = await self.collection.find_one({"_id": key})
        if cached:
            coords = tuple(cached["coordinates"])
            self.memory_cache[key] = (float(coords[0]), float(coords[1]))
            stats.geocode_cache_hits += 1
            return float(coords[0]), float(coords[1]), "cache-db"

        query = f"{locality}, {city}, India" if locality else f"{city}, India"
        coords = await self._query_nominatim(query, stats)
        quality = "nominatim-locality"

        if coords is None:
            coords = await self._query_nominatim(f"{city}, India", stats)
            quality = "nominatim-city"

        if coords is None:
            lon, lat = fallback_city_coordinates(city)
            coords = (lon, lat)
            quality = "fallback-city-centroid"

        if not self.dry_run:
            await self.collection.update_one(
                {"_id": key},
                {
                    "$set": {
                        "city": city,
                        "locality": locality,
                        "coordinates": [coords[0], coords[1]],
                        "quality": quality,
                        "updated_at": utc_now(),
                    },
                    "$setOnInsert": {"created_at": utc_now()},
                },
                upsert=True,
            )

        self.memory_cache[key] = coords
        return coords[0], coords[1], quality

    async def _query_nominatim(self, query: str, stats: ImportStats) -> tuple[float, float] | None:
        now = time.time()
        elapsed = now - self.last_call_ts
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)

        headers = {"User-Agent": settings.SCRAPER_USER_AGENT}
        params = {"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "in"}

        try:
            async with httpx.AsyncClient(timeout=20, headers=headers) as client:
                response = await client.get(NOMINATIM_URL, params=params)
                response.raise_for_status()
                rows = response.json()
                self.last_call_ts = time.time()
                stats.geocode_api_calls += 1
        except Exception:
            self.last_call_ts = time.time()
            return None

        if not rows:
            return None

        lat = float(rows[0]["lat"])
        lon = float(rows[0]["lon"])
        return lon, lat


async def ensure_indexes(collection: AsyncIOMotorCollection) -> None:
    await collection.create_index([("location", "2dsphere")])
    await collection.create_index([("dedupe_key", 1)], unique=True)
    await collection.create_index([("locality_id", 1), ("rent", 1)])
    await collection.create_index([("source_platform", 1), ("is_active", 1)])


def normalize_listing(raw: dict[str, Any], *, city: str, locality: str, lon: float, lat: float, run_id: str) -> dict[str, Any] | None:
    title = (raw.get("title") or "").strip()
    rent = parse_int(raw.get("price_inr"))

    if not title or not rent or rent <= 0:
        return None

    locality_id = stable_locality_id(city, locality)
    source_url = raw.get("url")
    dedupe_key = build_dedupe_key(title=title, rent=rent, locality_id=locality_id, source_url=source_url)
    now = utc_now()

    furnishing = raw.get("furnishing")
    amenities = [SourcePlatform.magicbricks.value, "dataset-imported"]
    if isinstance(furnishing, str) and furnishing.strip():
        amenities.append(furnishing.strip())

    bhk = parse_int(raw.get("bhk"))
    if bhk:
        amenities.append(f"{bhk}bhk")

    return {
        "title": title,
        "source_platform": SourcePlatform.magicbricks.value,
        "source_url": source_url,
        "property_type": normalize_property_type(raw.get("propertyType"), title),
        "rent": rent,
        "deposit": rent,
        "area_sqft": parse_int(raw.get("carpet_area_sqft")),
        "furnishing": furnishing,
        "images": [],
        "amenities": amenities,
        "location": {"type": "Point", "coordinates": [lon, lat]},
        "locality_id": locality_id,
        "nearby_metro": None,
        "commute_estimate_minutes": None,
        "dedupe_key": dedupe_key,
        "price_history": [
            {
                "source": SourcePlatform.magicbricks.value,
                "rent": rent,
                "url": source_url,
                "observed_at": now,
            }
        ],
        "created_at": now,
        "updated_at": now,
        "is_active": True,
        "scrape_run_id": run_id,
        "last_seen_at": now,
        "inactive_since": None,
        "city": city,
        "locality": locality,
        "search_mode": raw.get("searchMode"),
        "project_name": raw.get("project_name"),
        "developer": raw.get("developer"),
        "rera_id": raw.get("rera_id"),
        "ingestion_method": "dataset-json-import",
    }


def iter_json_files(dataset_dir: Path) -> list[Path]:
    return sorted(path for path in dataset_dir.glob("*.json") if path.is_file())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import MagicBricks datasetJson files into city-wise MongoDB collections.")
    parser.add_argument("--dataset-dir", default=str(REPO_ROOT / "datasetJson"), help="Directory containing dataset JSON files.")
    parser.add_argument("--city", action="append", default=[], help="Limit import to city (repeatable). If omitted, import all cities found.")
    parser.add_argument("--mongo-uri", default=settings.MONGODB_URI, help="MongoDB URI override.")
    parser.add_argument("--mongo-db", default=settings.MONGODB_DB, help="MongoDB database name override.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and normalize only, no database writes.")
    parser.add_argument("--no-deactivate-stale", action="store_true", help="Skip stale deactivation per city collection.")
    parser.add_argument("--also-write-default-properties", action="store_true", help="Also upsert into default properties collection for API compatibility.")
    parser.add_argument("--max-records", type=int, default=0, help="Limit normalized records for testing (0 = no limit).")
    return parser.parse_args()


async def run_import(args: argparse.Namespace) -> None:
    dataset_dir = Path(args.dataset_dir)
    if not dataset_dir.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    city_filter = {city.strip().lower() for city in args.city if city.strip()}
    run_id = f"dataset-magicbricks-{utc_now().strftime('%Y%m%dT%H%M%SZ')}"

    stats = ImportStats()

    client = AsyncIOMotorClient(args.mongo_uri)
    try:
        db = client[args.mongo_db]
        geocoder = LocalityGeocoder(db, dry_run=args.dry_run)

        files = iter_json_files(dataset_dir)
        seen_city_indexes: set[str] = set()
        observed_keys_by_collection: dict[str, set[str]] = defaultdict(set)

        for file_path in files:
            try:
                rows = json.loads(file_path.read_text(encoding="utf-8"))
            except Exception as exc:
                print(f"[WARN] Could not parse {file_path.name}: {exc}")
                continue

            if not isinstance(rows, list):
                print(f"[WARN] Unexpected non-array JSON in {file_path.name}, skipping.")
                continue

            stats.files_processed += 1

            for raw in rows:
                if not isinstance(raw, dict):
                    stats.records_skipped += 1
                    continue

                stats.records_seen += 1
                city = (raw.get("city") or "Unknown").strip() or "Unknown"
                locality = (raw.get("locality") or city).strip() or city

                if city_filter and city.lower() not in city_filter:
                    continue

                city_collection = city_collection_name(city)
                if city_collection not in seen_city_indexes and not args.dry_run:
                    await ensure_indexes(db[city_collection])
                    seen_city_indexes.add(city_collection)

                lon, lat, quality = await geocoder.resolve(city=city, locality=locality, stats=stats)
                payload = normalize_listing(raw, city=city, locality=locality, lon=lon, lat=lat, run_id=run_id)
                if not payload:
                    stats.records_skipped += 1
                    continue

                payload["geo_quality"] = quality
                stats.records_normalized += 1

                observed_keys_by_collection[city_collection].add(payload["dedupe_key"])

                if args.max_records and stats.records_normalized > args.max_records:
                    break

                if args.dry_run:
                    continue

                now = utc_now()
                payload["updated_at"] = now
                payload["last_seen_at"] = now
                payload["is_active"] = True
                payload["inactive_since"] = None
                payload["scrape_run_id"] = run_id

                await db[city_collection].update_one(
                    {"dedupe_key": payload["dedupe_key"]},
                    {
                        "$set": {k: v for k, v in payload.items() if k != "created_at"},
                        "$setOnInsert": {"created_at": payload.get("created_at", now), "first_seen_at": now},
                    },
                    upsert=True,
                )
                stats.records_upserted_city += 1

                if args.also_write_default_properties:
                    await db.properties.update_one(
                        {"dedupe_key": payload["dedupe_key"]},
                        {
                            "$set": {k: v for k, v in payload.items() if k != "created_at"},
                            "$setOnInsert": {"created_at": payload.get("created_at", now), "first_seen_at": now},
                        },
                        upsert=True,
                    )
                    stats.records_upserted_default += 1

            if args.max_records and stats.records_normalized > args.max_records:
                break

        if not args.dry_run and not args.no_deactivate_stale:
            now = utc_now()
            for collection_name, observed in observed_keys_by_collection.items():
                result = await db[collection_name].update_many(
                    {
                        "source_platform": SourcePlatform.magicbricks.value,
                        "dedupe_key": {"$nin": list(observed)},
                        "is_active": {"$ne": False},
                    },
                    {
                        "$set": {
                            "is_active": False,
                            "inactive_since": now,
                            "updated_at": now,
                            "scrape_run_id": run_id,
                        }
                    },
                )
                stats.stale_marked += result.modified_count

        summary = {
            "run_id": run_id,
            "dataset_dir": str(dataset_dir),
            "files_processed": stats.files_processed,
            "records_seen": stats.records_seen,
            "records_normalized": stats.records_normalized,
            "records_skipped": stats.records_skipped,
            "records_upserted_city": stats.records_upserted_city,
            "records_upserted_default": stats.records_upserted_default,
            "stale_marked": stats.stale_marked,
            "geocode_cache_hits": stats.geocode_cache_hits,
            "geocode_api_calls": stats.geocode_api_calls,
            "dry_run": bool(args.dry_run),
            "city_filter": sorted(city_filter),
            "also_write_default_properties": bool(args.also_write_default_properties),
        }
        print(json.dumps(summary, indent=2, default=str))
    finally:
        client.close()


def main() -> None:
    args = parse_args()
    asyncio.run(run_import(args))


if __name__ == "__main__":
    main()
