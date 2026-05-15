import argparse
import asyncio
import hashlib
import json
import logging
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient
from playwright.async_api import Page, Response, async_playwright

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import settings
from app.models.common import SourcePlatform


logger = logging.getLogger("housing_ingestion")

API_ENDPOINT_HINTS = (
    "/api/",
    "/graphql",
    "search",
    "listing",
    "property",
    "results",
)

TITLE_KEYS = ("title", "name", "displayName", "projectName", "headline")
RENT_KEYS = ("rent", "price", "monthlyRent", "amount", "minRent", "maxRent")
ID_KEYS = ("id", "propertyId", "listingId", "uuid", "inventoryId")
LAT_KEYS = ("lat", "latitude", "geoLat")
LON_KEYS = ("lng", "lon", "longitude", "geoLng")


@dataclass
class CollectedPayload:
    url: str
    body: Any


@dataclass
class IngestionSummary:
    payload_count: int
    candidate_count: int
    normalized_count: int
    upserted_count: int
    stale_marked_count: int
    skipped_count: int


class HousingNetworkCollector:
    def __init__(
        self,
        *,
        max_pages: int,
        wait_after_load_ms: int,
        scroll_steps: int,
        storage_state_path: str | None = None,
    ) -> None:
        self.max_pages = max_pages
        self.wait_after_load_ms = wait_after_load_ms
        self.scroll_steps = scroll_steps
        self.storage_state_path = storage_state_path
        self.payloads: list[CollectedPayload] = []

    async def collect(self, *, urls: list[str], headless: bool, timeout_ms: int) -> list[CollectedPayload]:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context_kwargs: dict[str, Any] = dict(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-IN",
                viewport={"width": 1460, "height": 900},
                timezone_id="Asia/Kolkata",
                extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
            )
            if self.storage_state_path:
                context_kwargs["storage_state"] = self.storage_state_path

            context = await browser.new_context(**context_kwargs)
            await context.add_init_script(
                """
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                """
            )
            page = await context.new_page()
            page.on("response", lambda response: asyncio.create_task(self._capture_response(response)))

            for raw_url in urls:
                page_urls = self._expand_paged_urls(raw_url)
                for page_url in page_urls:
                    logger.info("navigate %s", page_url)
                    try:
                        await page.goto(page_url, wait_until="domcontentloaded", timeout=timeout_ms)
                        await page.wait_for_timeout(self.wait_after_load_ms)
                        await self._scroll_to_trigger_requests(page)
                        try:
                            await page.wait_for_load_state("networkidle", timeout=5000)
                        except Exception:
                            pass
                        if await self._is_security_page(page):
                            logger.warning(
                                "security_or_bot_challenge_detected url=%s title=%s",
                                page.url,
                                await page.title(),
                            )
                        await self._capture_bootstrap_payloads(page, page_url)
                    except Exception as exc:
                        logger.warning("navigation failed url=%s error=%s", page_url, str(exc))

            await context.close()
            await browser.close()

        return self.payloads

    async def _is_security_page(self, page: Page) -> bool:
        title = (await page.title()).lower()
        if any(keyword in title for keyword in ("security", "access denied", "blocked", "attention required")):
            return True

        body_text = (await page.content()).lower()
        return any(keyword in body_text for keyword in ("are you a human", "bot", "datadome", "captcha", "security check"))

    def _expand_paged_urls(self, raw_url: str) -> list[str]:
        if "{page}" in raw_url:
            return [raw_url.format(page=page_number) for page_number in range(1, self.max_pages + 1)]
        return [raw_url]

    async def _scroll_to_trigger_requests(self, page: Page) -> None:
        for _ in range(self.scroll_steps):
            await page.mouse.wheel(0, 3000)
            await page.wait_for_timeout(700)

    async def _capture_response(self, response: Response) -> None:
        url = response.url
        lower_url = url.lower()
        if "housing" not in lower_url:
            return

        headers = response.headers
        content_type = headers.get("content-type", "")

        should_attempt_json = "json" in content_type.lower() or any(hint in lower_url for hint in API_ENDPOINT_HINTS)
        if not should_attempt_json:
            return

        body = await self._try_parse_response_body(response)
        if body is None:
            return

        self.payloads.append(CollectedPayload(url=url, body=body))

    async def _try_parse_response_body(self, response: Response) -> Any | None:
        try:
            return await response.json()
        except Exception:
            pass

        try:
            text_body = await response.text()
        except Exception:
            return None

        if not text_body:
            return None

        body_trimmed = text_body.strip()
        if not body_trimmed:
            return None

        if body_trimmed[0] not in "[{":
            return None

        try:
            return json.loads(body_trimmed)
        except Exception:
            return None

    async def _capture_bootstrap_payloads(self, page: Page, page_url: str) -> None:
        # Some Housing search routes render listing state server-side with limited API calls.
        # This fallback captures bootstrapped JSON objects from window/script state.
        try:
            snapshots = await page.evaluate(
                """() => {
                    const out = [];
                    const keys = ["__NEXT_DATA__", "__INITIAL_STATE__", "__PRELOADED_STATE__"];

                    for (const key of keys) {
                        if (typeof window[key] !== "undefined") {
                            out.push({ key, payload: window[key] });
                        }
                    }

                    const nextDataScript = document.querySelector("script#__NEXT_DATA__");
                    if (nextDataScript?.textContent) {
                        try {
                            out.push({ key: "__NEXT_DATA___SCRIPT", payload: JSON.parse(nextDataScript.textContent) });
                        } catch {
                        }
                    }

                    return out;
                }"""
            )
        except Exception as exc:
            logger.warning("bootstrap_payload_capture_failed url=%s error=%s", page_url, str(exc))
            return

        if not isinstance(snapshots, list):
            return

        for snapshot in snapshots:
            payload = snapshot.get("payload") if isinstance(snapshot, dict) else None
            key = snapshot.get("key") if isinstance(snapshot, dict) else "window"
            if payload is not None:
                self.payloads.append(CollectedPayload(url=f"{page_url}#{key}", body=payload))


class HousingNormalizer:
    def __init__(self, city: str, run_id: str) -> None:
        self.city = city
        self.city_slug = slugify(city)
        self.run_id = run_id

    def normalize_many(self, payloads: list[CollectedPayload], limit: int | None = None) -> tuple[list[dict[str, Any]], int]:
        candidates: list[tuple[dict[str, Any], str]] = []
        seen_payload = set()

        for payload in payloads:
            fingerprint = hashlib.sha1(f"{payload.url}:{json.dumps(payload.body, sort_keys=True, default=str)}".encode("utf-8")).hexdigest()
            if fingerprint in seen_payload:
                continue
            seen_payload.add(fingerprint)
            candidates.extend((item, payload.url) for item in extract_listing_candidates(payload.body))

        deduped: dict[str, dict[str, Any]] = {}
        skipped = 0

        for raw_item, source_url in candidates:
            normalized = self._normalize_listing(raw_item, source_url)
            if not normalized:
                skipped += 1
                continue
            deduped[normalized["dedupe_key"]] = normalized
            if limit and len(deduped) >= limit:
                break

        return list(deduped.values()), skipped

    def _normalize_listing(self, raw_item: dict[str, Any], source_url: str) -> dict[str, Any] | None:
        title = pick_first_string(raw_item, TITLE_KEYS) or "Housing listing"
        property_id = pick_first_string(raw_item, ID_KEYS)

        rent_value = pick_first_number(raw_item, RENT_KEYS)
        if rent_value is None or rent_value <= 0:
            return None

        coords = extract_coordinates(raw_item)
        if not coords:
            return None
        lon, lat = coords

        property_type = infer_property_type(raw_item, title)
        listing_url = extract_listing_url(raw_item) or source_url
        images = extract_images(raw_item)
        amenities = extract_amenities(raw_item)

        now = datetime.now(timezone.utc)
        stable_identity = property_id or f"{title}:{lon:.5f}:{lat:.5f}:{rent_value}:{listing_url}"
        dedupe_key = hashlib.sha1(stable_identity.encode("utf-8")).hexdigest()

        return {
            "title": title,
            "source_platform": SourcePlatform.housing.value,
            "source_url": listing_url,
            "property_type": property_type,
            "rent": int(rent_value),
            "deposit": extract_deposit(raw_item, int(rent_value)),
            "area_sqft": extract_area_sqft(raw_item),
            "furnishing": extract_furnishing(raw_item),
            "images": images,
            "amenities": amenities,
            "location": {"type": "Point", "coordinates": [float(lon), float(lat)]},
            "locality_id": f"housing-{self.city_slug}",
            "nearby_metro": pick_first_string(raw_item, ("nearbyMetro", "metro", "nearestMetro")),
            "commute_estimate_minutes": None,
            "dedupe_key": dedupe_key,
            "price_history": [
                {
                    "source": SourcePlatform.housing.value,
                    "rent": int(rent_value),
                    "url": listing_url,
                    "observed_at": now,
                }
            ],
            "created_at": now,
            "updated_at": now,
            "is_active": True,
            "scrape_run_id": self.run_id,
            "last_seen_at": now,
            "inactive_since": None,
            "raw_listing_id": property_id,
            "ingestion_method": "playwright-network-json",
        }


def extract_listing_candidates(node: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    def walk(item: Any) -> None:
        if isinstance(item, dict):
            if looks_like_listing(item):
                candidates.append(item)
            for value in item.values():
                walk(value)
            return
        if isinstance(item, list):
            for child in item:
                walk(child)

    walk(node)
    return candidates


def looks_like_listing(item: dict[str, Any]) -> bool:
    has_price = pick_first_number(item, RENT_KEYS) is not None
    has_title_or_id = pick_first_string(item, TITLE_KEYS) is not None or pick_first_string(item, ID_KEYS) is not None
    has_coords = extract_coordinates(item) is not None
    return has_price and has_title_or_id and has_coords


def extract_coordinates(item: dict[str, Any]) -> tuple[float, float] | None:
    lat = pick_first_number(item, LAT_KEYS)
    lon = pick_first_number(item, LON_KEYS)

    if lat is not None and lon is not None:
        return float(lon), float(lat)

    coordinates = item.get("coordinates")
    if isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
        first = parse_float(coordinates[0])
        second = parse_float(coordinates[1])
        if first is not None and second is not None:
            if abs(first) <= 90 and abs(second) <= 180:
                return float(second), float(first)
            return float(first), float(second)

    location = item.get("location")
    if isinstance(location, dict):
        lat_loc = pick_first_number(location, LAT_KEYS)
        lon_loc = pick_first_number(location, LON_KEYS)
        if lat_loc is not None and lon_loc is not None:
            return float(lon_loc), float(lat_loc)

    nested = find_coordinates_in_tree(item)
    if nested:
        return nested

    return None


def find_coordinates_in_tree(node: Any) -> tuple[float, float] | None:
    if isinstance(node, dict):
        lat = pick_first_number(node, LAT_KEYS)
        lon = pick_first_number(node, LON_KEYS)
        if lat is not None and lon is not None:
            return float(lon), float(lat)

        for value in node.values():
            found = find_coordinates_in_tree(value)
            if found:
                return found
        return None

    if isinstance(node, list):
        for value in node:
            found = find_coordinates_in_tree(value)
            if found:
                return found

    return None


def extract_listing_url(item: dict[str, Any]) -> str | None:
    for key in ("url", "detailUrl", "canonicalUrl", "seoUrl", "link"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            if value.startswith("http"):
                return value
            if value.startswith("/"):
                return f"https://housing.com{value}"
    return None


def extract_images(item: dict[str, Any]) -> list[str]:
    images_raw = item.get("images") or item.get("imageUrls") or item.get("photos") or item.get("media")
    output: list[str] = []

    if isinstance(images_raw, list):
        for image in images_raw:
            if isinstance(image, str) and image.strip():
                output.append(image)
            elif isinstance(image, dict):
                maybe_url = pick_first_string(image, ("url", "src", "large", "medium", "small"))
                if maybe_url:
                    output.append(maybe_url)

    return dedupe_strings(output)


def extract_amenities(item: dict[str, Any]) -> list[str]:
    amenity_values = item.get("amenities") or item.get("features") or item.get("facility") or item.get("facilities")
    output: list[str] = []

    if isinstance(amenity_values, list):
        for value in amenity_values:
            if isinstance(value, str):
                output.append(value)
            elif isinstance(value, dict):
                name = pick_first_string(value, ("name", "label", "title"))
                if name:
                    output.append(name)
    elif isinstance(amenity_values, dict):
        for key, enabled in amenity_values.items():
            if enabled:
                output.append(str(key))

    if not output:
        output.append("housing-network-captured")

    return dedupe_strings(output)


def extract_area_sqft(item: dict[str, Any]) -> int | None:
    for key in ("area", "areaSqft", "builtUpArea", "superBuiltupArea", "carpetArea"):
        value = parse_int(item.get(key))
        if value and value > 0:
            return value
    return None


def extract_deposit(item: dict[str, Any], rent: int) -> int:
    for key in ("deposit", "securityDeposit", "tokenAmount"):
        value = parse_int(item.get(key))
        if value and value > 0:
            return value
    return rent


def extract_furnishing(item: dict[str, Any]) -> str | None:
    return pick_first_string(item, ("furnishing", "furnishingStatus", "furnishedType"))


def infer_property_type(item: dict[str, Any], title: str) -> str:
    candidate = pick_first_string(item, ("propertyType", "type", "subType"))
    text = f"{candidate or ''} {title}".lower()

    if "pg" in text or "paying guest" in text:
        return "PG"
    if "hostel" in text:
        return "hostel"
    if "studio" in text or "1rk" in text:
        return "studio"
    if "shared" in text or "room" in text:
        return "shared flat"
    return "apartment"


def pick_first_string(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def pick_first_number(item: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        value = item.get(key)
        parsed = parse_int(value)
        if parsed is not None and parsed > 0:
            return parsed
    return None


def parse_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        digits = re.sub(r"[^0-9]", "", value)
        if not digits:
            return None
        try:
            return int(digits)
        except ValueError:
            return None
    return None


def parse_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        normalized = value.strip()
        lowered = normalized.lower()
        if not normalized or lowered in seen:
            continue
        seen.add(lowered)
        output.append(normalized)
    return output


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "india"


def run_id_now() -> str:
    return datetime.now(timezone.utc).strftime("housing-%Y%m%dT%H%M%SZ")


def default_search_urls(city: str) -> list[str]:
    city_slug = slugify(city)
    if city_slug == "kolkata":
        return [
            "https://housing.com/rent/flats-for-rent-in-kolkata-west-bengal-P40qcmycif4m431jo",
            "https://housing.com/in/buy/kolkata",
        ]

    # These are seed URLs. Update/extend with explicit --search-url flags for better coverage.
    return [
        f"https://housing.com/in/rent/{city_slug}",
        f"https://housing.com/in/buy/{city_slug}",
    ]


async def upsert_properties(
    db: Any,
    properties: list[dict[str, Any]],
    *,
    run_id: str,
    deactivate_stale: bool,
) -> tuple[int, int]:
    if not properties:
        return 0, 0

    coll = db.properties
    observed_keys: list[str] = []
    upserted_count = 0
    now = datetime.now(timezone.utc)

    for item in properties:
        observed_keys.append(item["dedupe_key"])
        payload = dict(item)
        payload["updated_at"] = now
        payload["last_seen_at"] = now
        payload["is_active"] = True
        payload["inactive_since"] = None
        payload["scrape_run_id"] = run_id

        await coll.update_one(
            {"dedupe_key": payload["dedupe_key"]},
            {
                "$set": payload,
                "$setOnInsert": {
                    "created_at": payload.get("created_at", now),
                    "first_seen_at": now,
                },
            },
            upsert=True,
        )
        upserted_count += 1

    stale_marked_count = 0
    if deactivate_stale:
        stale_result = await coll.update_many(
            {
                "source_platform": SourcePlatform.housing.value,
                "dedupe_key": {"$nin": observed_keys},
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
        stale_marked_count = stale_result.modified_count

    return upserted_count, stale_marked_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Housing.com using Playwright network interception and upsert normalized property listings into MongoDB."
    )
    parser.add_argument("--city", default="Kolkata", help="City or place label used for locality grouping.")
    parser.add_argument(
        "--search-url",
        action="append",
        default=[],
        help="Search/listing page URL to visit. Add multiple times. Use {page} for pagination templates.",
    )
    parser.add_argument("--max-pages", type=int, default=2, help="Max pages when URL contains {page} template.")
    parser.add_argument("--wait-after-load-ms", type=int, default=3500, help="Wait time after each page load.")
    parser.add_argument("--scroll-steps", type=int, default=6, help="Scroll loops to trigger lazy network calls.")
    parser.add_argument("--timeout-ms", type=int, default=60000, help="Navigation timeout in milliseconds.")
    parser.add_argument("--headful", action="store_true", help="Run browser with UI for debugging.")
    parser.add_argument(
        "--storage-state",
        default=None,
        help="Path to Playwright storage state JSON captured from a trusted human session.",
    )
    parser.add_argument("--limit", type=int, default=500, help="Maximum normalized listings per run.")
    parser.add_argument("--mongo-uri", default=settings.MONGODB_URI, help="MongoDB connection URI override.")
    parser.add_argument("--mongo-db", default=settings.MONGODB_DB, help="MongoDB database name override.")
    parser.add_argument(
        "--no-deactivate-stale",
        action="store_true",
        help="Do not mark missing previous Housing listings inactive.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Collect and normalize only, without DB writes.")
    return parser.parse_args()


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


async def main() -> None:
    setup_logging()
    args = parse_args()

    run_id = run_id_now()
    urls = args.search_url or default_search_urls(args.city)

    logger.info("starting run_id=%s city=%s", run_id, args.city)
    logger.info("targets=%s", ", ".join(urls))

    collector = HousingNetworkCollector(
        max_pages=max(1, args.max_pages),
        wait_after_load_ms=max(0, args.wait_after_load_ms),
        scroll_steps=max(0, args.scroll_steps),
        storage_state_path=args.storage_state,
    )

    payloads = await collector.collect(
        urls=urls,
        headless=not args.headful,
        timeout_ms=max(1000, args.timeout_ms),
    )

    normalizer = HousingNormalizer(city=args.city, run_id=run_id)
    normalized, skipped_count = normalizer.normalize_many(payloads, limit=max(1, args.limit))

    upserted_count = 0
    stale_marked_count = 0

    if args.dry_run:
        logger.info("dry-run enabled, skipping DB writes")
    else:
        client = AsyncIOMotorClient(args.mongo_uri)
        try:
            db = client[args.mongo_db]
            upserted_count, stale_marked_count = await upsert_properties(
                db,
                normalized,
                run_id=run_id,
                deactivate_stale=not args.no_deactivate_stale,
            )
        finally:
            client.close()

    summary = IngestionSummary(
        payload_count=len(payloads),
        candidate_count=sum(len(extract_listing_candidates(payload.body)) for payload in payloads),
        normalized_count=len(normalized),
        upserted_count=upserted_count,
        stale_marked_count=stale_marked_count,
        skipped_count=skipped_count,
    )

    logger.info(
        "completed run_id=%s payloads=%s candidates=%s normalized=%s upserted=%s stale_marked=%s skipped=%s",
        run_id,
        summary.payload_count,
        summary.candidate_count,
        summary.normalized_count,
        summary.upserted_count,
        summary.stale_marked_count,
        summary.skipped_count,
    )

    if summary.payload_count == 0:
        logger.warning(
            "no_payloads_captured likely due anti-bot protection or non-matching URL. "
            "Try a working Housing search URL and optionally pass --storage-state <state.json>."
        )


if __name__ == "__main__":
    asyncio.run(main())
