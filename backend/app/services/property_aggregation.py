import asyncio
import hashlib
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import structlog

from app.core.config import settings
from app.models.common import GeoPoint, SourcePlatform, utc_now
from app.models.property import PriceObservation, Property

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class ListingSourceInfo:
    id: str
    name: str
    role: str
    ingestion_methods: list[str]
    status: str
    note: str


class ListingProvider(Protocol):
    source_id: str
    source_platform: SourcePlatform

    async def fetch(self, place: str, limit: int) -> list[Property]:
        pass


class PropertyAggregationService:
    def __init__(self) -> None:
        self.providers: dict[str, ListingProvider] = {
            "magicbricks": MagicBricksProvider(),
            "99acres": Acres99Provider(),
            "nobroker": NoBrokerProvider(),
            "broker_crm": BrokerCrmProvider(),
        }

    async def aggregate(self, place: str, limit: int = 40, sources: list[str] | None = None) -> list[Property]:
        selected = self._selected_providers(sources)
        per_source_limit = max(5, limit // max(1, len(selected)))
        results = await asyncio.gather(
            *(provider.fetch(place=place, limit=per_source_limit) for provider in selected),
            return_exceptions=True,
        )

        properties: list[Property] = []
        for provider, result in zip(selected, results):
            if isinstance(result, Exception):
                logger.warning("listing_provider_failed", source=provider.source_id, error=str(result))
                continue
            properties.extend(result)

        return self._dedupe(properties)[:limit]

    def sources(self) -> list[ListingSourceInfo]:
        return [
            ListingSourceInfo(
                id="magicbricks",
                name="MagicBricks",
                role="bulk listings",
                ingestion_methods=["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
                status="adapter-ready",
                note="Use partnership/API where possible; scraper hooks are isolated behind adapters.",
            ),
            ListingSourceInfo(
                id="99acres",
                name="99acres",
                role="builder and broker inventory",
                ingestion_methods=["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
                status="adapter-ready",
                note="Good for apartments, builder inventory, and broker-posted rentals.",
            ),
            ListingSourceInfo(
                id="nobroker",
                name="NoBroker",
                role="owner-listed rentals",
                ingestion_methods=["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
                status="adapter-ready",
                note="Important source for lower-friction rentals and owner listings.",
            ),
            ListingSourceInfo(
                id="broker_crm",
                name="Broker CRM feeds",
                role="fresh hyperlocal inventory",
                ingestion_methods=["CSV feed", "JSON feed", "webhook", "manual upload"],
                status="adapter-ready",
                note="Most useful for fresh India locality inventory before public portals update.",
            ),
            ListingSourceInfo(
                id="mapbox",
                name="Mapbox",
                role="geo intelligence",
                ingestion_methods=["Mapbox geocoding/search"],
                status="implemented separately",
                note="Used for coordinates, map rendering, and locality/place context; not a listing marketplace.",
            ),
            ListingSourceInfo(
                id="rera",
                name="RERA",
                role="legal verification",
                ingestion_methods=["state RERA public datasets", "govt feeds", "scheduled sync"],
                status="planned enrichment",
                note="Use for project/legal verification, not rental discovery.",
            ),
            ListingSourceInfo(
                id="census_open_govt",
                name="Census/Open govt data",
                role="demographics",
                ingestion_methods=["open datasets", "scheduled sync"],
                status="planned enrichment",
                note="Use for locality demographics and civic scoring.",
            ),
        ]

    def _selected_providers(self, sources: list[str] | None) -> list[ListingProvider]:
        source_ids = sources or ["magicbricks", "99acres", "nobroker", "broker_crm"]
        providers = [self.providers[source_id] for source_id in source_ids if source_id in self.providers]
        return providers or list(self.providers.values())

    def _dedupe(self, properties: list[Property]) -> list[Property]:
        seen: set[str] = set()
        unique: list[Property] = []
        for item in properties:
            coords = item.location.coordinates if item.location else (0.0, 0.0)
            key = f"{item.title.lower()}:{round(coords[0], 4)}:{round(coords[1], 4)}:{item.rent}"
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return sorted(unique, key=lambda prop: prop.rent)


class PortalProvider:
    source_id: str
    source_platform: SourcePlatform
    apify_actor_setting: str
    brightdata_dataset_setting: str
    sample_titles: list[str]

    async def fetch(self, place: str, limit: int) -> list[Property]:
        live = await self._fetch_live(place=place, limit=limit)
        if live:
            return live
        return self._sample_properties(place=place, limit=limit)

    async def _fetch_live(self, place: str, limit: int) -> list[Property]:
        apify_actor_id = getattr(settings, self.apify_actor_setting)
        brightdata_dataset_id = getattr(settings, self.brightdata_dataset_setting)

        if settings.APIFY_TOKEN and apify_actor_id:
            return await self._fetch_apify(actor_id=apify_actor_id, place=place, limit=limit)
        if settings.BRIGHTDATA_API_KEY and brightdata_dataset_id:
            return await self._fetch_brightdata(dataset_id=brightdata_dataset_id, place=place, limit=limit)
        return []

    async def _fetch_apify(self, actor_id: str, place: str, limit: int) -> list[Property]:
        url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
        payload = {"query": place, "maxItems": limit, "country": "IN"}
        params = {"token": settings.APIFY_TOKEN}
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(url, params=params, json=payload)
            response.raise_for_status()
            items = response.json()
        return [self._from_external_item(item, place, "Apify") for item in items[:limit]]

    async def _fetch_brightdata(self, dataset_id: str, place: str, limit: int) -> list[Property]:
        url = f"https://api.brightdata.com/datasets/v3/snapshot/{dataset_id}"
        headers = {"Authorization": f"Bearer {settings.BRIGHTDATA_API_KEY}"}
        params = {"format": "json", "limit": limit, "query": place}
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            items = response.json()
        return [self._from_external_item(item, place, "BrightData") for item in items[:limit]]

    def _from_external_item(self, item: dict[str, Any], place: str, ingestion_method: str) -> Property:
        title = item.get("title") or item.get("name") or f"{self.source_platform.value} listing near {place}"
        rent = int(item.get("rent") or item.get("price") or estimated_rent(self.source_platform.value, place, 0))
        lon = float(item.get("longitude") or item.get("lng") or fallback_coordinates(place)[0])
        lat = float(item.get("latitude") or item.get("lat") or fallback_coordinates(place)[1])
        property_type = item.get("property_type") or item.get("type") or "apartment"
        source_url = item.get("url") or item.get("source_url")
        source_id = stable_id(self.source_id, title, lon, lat, rent)
        now = utc_now()

        return Property(
            _id=source_id,
            title=title,
            source_platform=self.source_platform,
            source_url=source_url,
            property_type=property_type,
            rent=rent,
            deposit=item.get("deposit") or rent,
            area_sqft=item.get("area_sqft") or item.get("area") or 500,
            furnishing=item.get("furnishing") or "verification needed",
            images=item.get("images") or [],
            amenities=(item.get("amenities") or []) + [ingestion_method],
            location=GeoPoint(coordinates=(lon, lat)),
            locality_id=stable_locality_id(place),
            nearby_metro=item.get("nearby_metro") or "Nearest metro TBD",
            commute_estimate_minutes=item.get("commute_estimate_minutes"),
            dedupe_key=source_id,
            price_history=[PriceObservation(source=self.source_platform, rent=rent, url=source_url)],
            lowest_price=PriceObservation(source=self.source_platform, rent=rent, url=source_url),
            created_at=now,
            updated_at=now,
        )

    def _sample_properties(self, place: str, limit: int) -> list[Property]:
        base_lon, base_lat = fallback_coordinates(place)
        now = utc_now()
        properties: list[Property] = []
        for index, title in enumerate(self.sample_titles[:limit]):
            lon = base_lon + (index - 1) * 0.012
            lat = base_lat + ((index % 3) - 1) * 0.009
            property_type = property_type_from_title(title)
            rent = estimated_rent(property_type, place, index)
            source_id = stable_id(self.source_id, title, lon, lat, rent)
            properties.append(
                Property(
                    _id=source_id,
                    title=title,
                    source_platform=self.source_platform,
                    source_url=None,
                    property_type=property_type,
                    rent=rent,
                    deposit=rent * 2 if property_type == "apartment" else rent,
                    area_sqft=520 if property_type == "apartment" else 160,
                    furnishing="semi-furnished" if property_type == "apartment" else "furnished",
                    images=[],
                    amenities=[self.source_platform.value, "sample normalized listing", "replace with Apify/BrightData/live feed"],
                    location=GeoPoint(coordinates=(lon, lat)),
                    locality_id=stable_locality_id(place),
                    nearby_metro="Nearest metro TBD",
                    commute_estimate_minutes=12 + index * 7,
                    dedupe_key=source_id,
                    price_history=[PriceObservation(source=self.source_platform, rent=rent)],
                    lowest_price=PriceObservation(source=self.source_platform, rent=rent),
                    created_at=now,
                    updated_at=now,
                )
            )
        return properties


class MagicBricksProvider(PortalProvider):
    source_id = "magicbricks"
    source_platform = SourcePlatform.magicbricks
    apify_actor_setting = "APIFY_MAGICBRICKS_ACTOR_ID"
    brightdata_dataset_setting = "BRIGHTDATA_MAGICBRICKS_DATASET_ID"
    sample_titles = [
        "MagicBricks 1BHK near IT hub",
        "MagicBricks furnished studio close to metro",
        "MagicBricks shared flat in gated building",
        "MagicBricks 2BHK for working professionals",
    ]


class Acres99Provider(PortalProvider):
    source_id = "99acres"
    source_platform = SourcePlatform.acres99
    apify_actor_setting = "APIFY_99ACRES_ACTOR_ID"
    brightdata_dataset_setting = "BRIGHTDATA_99ACRES_DATASET_ID"
    sample_titles = [
        "99acres builder floor near office corridor",
        "99acres apartment with power backup",
        "99acres compact rental near transit",
        "99acres owner-listed semi furnished flat",
    ]


class NoBrokerProvider(PortalProvider):
    source_id = "nobroker"
    source_platform = SourcePlatform.nobroker
    apify_actor_setting = "APIFY_NOBROKER_ACTOR_ID"
    brightdata_dataset_setting = "BRIGHTDATA_NOBROKER_DATASET_ID"
    sample_titles = [
        "NoBroker owner-listed 1RK",
        "NoBroker no-brokerage 1BHK",
        "NoBroker furnished shared room",
        "NoBroker family apartment near main road",
    ]


class BrokerCrmProvider:
    source_id = "broker_crm"
    source_platform = SourcePlatform.broker_crm
    sample_titles = [
        "Broker CRM fresh PG near office gate",
        "Broker CRM verified 1BHK with owner contact",
        "Broker CRM shared flat near metro",
        "Broker CRM co-living inventory from local agent",
    ]

    async def fetch(self, place: str, limit: int) -> list[Property]:
        if settings.BROKER_CRM_FEED_URL:
            return await self._fetch_feed(place=place, limit=limit)
        return PortalProvider._sample_properties(self, place=place, limit=limit)

    async def _fetch_feed(self, place: str, limit: int) -> list[Property]:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(settings.BROKER_CRM_FEED_URL, params={"place": place, "limit": limit})
            response.raise_for_status()
            items = response.json()
        portal = PortalProvider()
        portal.source_id = self.source_id
        portal.source_platform = self.source_platform
        return [portal._from_external_item(item, place, "Broker CRM feed") for item in items[:limit]]


def fallback_coordinates(place: str) -> tuple[float, float]:
    text = place.lower()
    if "kolkata" in text or "sector v" in text or "salt lake" in text:
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
    return 77.209, 28.6139


def property_type_from_title(title: str) -> str:
    text = title.lower()
    if "pg" in text or "room" in text:
        return "PG"
    if "studio" in text or "1rk" in text:
        return "studio"
    if "shared" in text:
        return "shared flat"
    return "apartment"


def estimated_rent(property_type: str, place: str, seed: int | float) -> int:
    base_by_type = {"PG": 9000, "studio": 12500, "shared flat": 10500, "apartment": 15500}
    base = base_by_type.get(property_type, 13500)
    place_factor = 1.1 if any(term in place.lower() for term in ["sector v", "salt lake", "indiranagar", "bandra", "hitech"]) else 1
    adjustment = int((abs(hash(f"{property_type}:{place}:{seed}")) % 4500) / 500) * 500
    return round((base * place_factor + adjustment) / 500) * 500


def stable_id(source: str, title: str, lon: float, lat: float, rent: int) -> str:
    digest = hashlib.sha1(f"{source}:{title}:{lon}:{lat}:{rent}".encode()).hexdigest()[:12]
    return f"{source}-{digest}"


def stable_locality_id(place: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in place).strip("-")
    digest = hashlib.sha1(place.encode()).hexdigest()[:6]
    return f"listing-{slug}-{digest}"
