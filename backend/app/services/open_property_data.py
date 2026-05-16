import asyncio
import hashlib
import os
from math import cos, radians
from typing import Any, Protocol

import httpx
import structlog

from app.core.config import settings
from app.models.common import GeoPoint, SourcePlatform, utc_now
from app.models.property import PriceObservation, Property

logger = structlog.get_logger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
DEFAULT_MAPBOX_PUBLIC_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "")


class PropertyLeadProvider(Protocol):
    source: str

    async def fetch(self, place: str, limit: int) -> list[Property]:
        pass


class OpenPropertyDataService:
    """Multi-source free/open property lead aggregation.

    These providers populate the map with discovery leads. They are not a
    replacement for verified rental marketplace feeds, broker uploads, and
    user-submitted inventory.
    """

    def __init__(self) -> None:
        self.providers: dict[str, PropertyLeadProvider] = {
            "osm": OpenStreetMapPropertyProvider(),
            "mapbox": MapboxSearchPropertyProvider(),
        }

    async def fetch_property_leads(self, place: str, limit: int = 25, sources: list[str] | None = None) -> list[Property]:
        selected = self._selected_providers(sources)
        results = await asyncio.gather(
            *(provider.fetch(place=place, limit=max(5, limit // max(1, len(selected)))) for provider in selected),
            return_exceptions=True,
        )

        properties: list[Property] = []
        for provider, result in zip(selected, results):
            if isinstance(result, Exception):
                logger.warning("property_provider_failed", source=provider.source, error=str(result))
                continue
            properties.extend(result)

        return self._dedupe(properties)[:limit]

    def available_sources(self) -> list[dict[str, str]]:
        return [
            {
                "id": "osm",
                "name": "OpenStreetMap Overpass",
                "kind": "open map data",
                "note": "Finds mapped hostels, dormitories, apartment and residential buildings.",
            },
            {
                "id": "mapbox",
                "name": "Mapbox Geocoding/Search",
                "kind": "map search",
                "note": "Finds India POI/place leads for hostel, PG, co-living, and apartment-like searches.",
            },
            {
                "id": "database",
                "name": "Normalized Properties Collection",
                "kind": "internal inventory",
                "note": "Verified marketplace, broker, user-submitted, and scraped listings stored in MongoDB.",
            },
        ]

    def _selected_providers(self, sources: list[str] | None) -> list[PropertyLeadProvider]:
        selected_ids = sources or list(self.providers)
        providers = [self.providers[source] for source in selected_ids if source in self.providers]
        return providers or list(self.providers.values())

    def _dedupe(self, properties: list[Property]) -> list[Property]:
        seen: set[str] = set()
        unique: list[Property] = []
        for item in properties:
            coordinates = item.location.coordinates if item.location else (0, 0)
            key = f"{item.title.lower()}:{round(coordinates[0], 4)}:{round(coordinates[1], 4)}"
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return unique


class OpenStreetMapPropertyProvider:
    source = "osm"

    async def fetch(self, place: str, limit: int) -> list[Property]:
        coordinates = await self._geocode(place)
        if not coordinates:
            return []
        elements = await self._overpass_property_candidates(coordinates)
        return [self._to_property(element, place) for element in elements[:limit]]

    async def _geocode(self, place: str) -> tuple[float, float] | None:
        headers = {"User-Agent": settings.SCRAPER_USER_AGENT}
        params = {"q": f"{place}, India", "format": "jsonv2", "limit": 1, "countrycodes": "in"}
        async with httpx.AsyncClient(timeout=20, headers=headers) as client:
            response = await client.get(NOMINATIM_URL, params=params)
            response.raise_for_status()
            results = response.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])

    async def _overpass_property_candidates(self, coordinates: tuple[float, float]) -> list[dict[str, Any]]:
        lat, lon = coordinates
        query = f"""
        [out:json][timeout:25];
        (
          node(around:4500,{lat},{lon})["tourism"="hostel"];
          way(around:4500,{lat},{lon})["tourism"="hostel"];
          relation(around:4500,{lat},{lon})["tourism"="hostel"];
          node(around:4500,{lat},{lon})["amenity"="hostel"];
          way(around:4500,{lat},{lon})["amenity"="hostel"];
          relation(around:4500,{lat},{lon})["amenity"="hostel"];
          node(around:4500,{lat},{lon})["building"~"apartments|residential|dormitory"];
          way(around:4500,{lat},{lon})["building"~"apartments|residential|dormitory"];
          relation(around:4500,{lat},{lon})["building"~"apartments|residential|dormitory"];
        );
        out center tags 80;
        """
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(OVERPASS_URL, data={"data": query})
            response.raise_for_status()
            payload = response.json()
        return payload.get("elements", [])

    def _to_property(self, element: dict[str, Any], place: str) -> Property:
        tags = element.get("tags", {})
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")
        name = tags.get("name") or self._fallback_name(tags, place)
        property_type = self._property_type(tags)
        rent = estimated_rent(property_type, place, lat, lon)
        source_id = f"osm-{element.get('type')}-{element.get('id')}"
        now = utc_now()

        return Property(
            _id=source_id,
            title=name,
            source_platform=SourcePlatform.openstreetmap,
            source_url=f"https://www.openstreetmap.org/{element.get('type')}/{element.get('id')}",
            property_type=property_type,
            rent=rent,
            deposit=rent,
            area_sqft=160 if property_type in {"PG", "hostel", "co-living"} else 520,
            furnishing="verification needed",
            images=[],
            amenities=self._amenities(tags),
            location=GeoPoint(coordinates=(float(lon), float(lat))),
            locality_id=stable_locality_id(place),
            nearby_metro=tags.get("station") or "Nearest metro TBD",
            commute_estimate_minutes=None,
            dedupe_key=source_id,
            price_history=[
                PriceObservation(
                    source=SourcePlatform.openstreetmap,
                    rent=rent,
                    url=f"https://www.openstreetmap.org/{element.get('type')}/{element.get('id')}",
                )
            ],
            lowest_price=PriceObservation(source=SourcePlatform.openstreetmap, rent=rent),
            created_at=now,
            updated_at=now,
        )

    def _fallback_name(self, tags: dict[str, str], place: str) -> str:
        building = tags.get("building", "residential")
        return f"{building.title()} lead near {place}"

    def _property_type(self, tags: dict[str, str]) -> str:
        if tags.get("tourism") == "hostel" or tags.get("amenity") == "hostel":
            return "hostel"
        if tags.get("building") == "dormitory":
            return "PG"
        if tags.get("building") == "apartments":
            return "apartment"
        return "shared flat"

    def _amenities(self, tags: dict[str, str]) -> list[str]:
        amenities = ["OSM verified location", "price needs verification"]
        if tags.get("internet_access"):
            amenities.append("internet tagged")
        if tags.get("wheelchair"):
            amenities.append("accessibility tagged")
        if tags.get("building") == "apartments":
            amenities.append("residential building")
        return amenities


class MapboxSearchPropertyProvider:
    source = "mapbox"

    async def fetch(self, place: str, limit: int) -> list[Property]:
        token = settings.MAPBOX_ACCESS_TOKEN or DEFAULT_MAPBOX_PUBLIC_TOKEN
        search_terms = [
            f"PG near {place}",
            f"hostel near {place}",
            f"co living near {place}",
            f"apartment near {place}",
        ]
        async with httpx.AsyncClient(timeout=20) as client:
            responses = await asyncio.gather(
                *(self._search(client, term, token, max(2, limit // len(search_terms))) for term in search_terms),
                return_exceptions=True,
            )

        features: list[dict[str, Any]] = []
        for response in responses:
            if isinstance(response, Exception):
                logger.warning("mapbox_search_failed", error=str(response))
                continue
            features.extend(response)
        return [self._to_property(feature, place) for feature in features[:limit]]

    async def _search(self, client: httpx.AsyncClient, query: str, token: str, limit: int) -> list[dict[str, Any]]:
        url = f"{MAPBOX_GEOCODING_URL}/{query}.json"
        params = {
            "access_token": token,
            "country": "in",
            "limit": min(limit, 10),
            "types": "poi,address,place",
            "autocomplete": "false",
        }
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json().get("features", [])

    def _to_property(self, feature: dict[str, Any], place: str) -> Property:
        coordinates = feature.get("center") or [0, 0]
        name = feature.get("text") or feature.get("place_name") or f"Mapbox lead near {place}"
        context = feature.get("place_name", place)
        property_type = self._property_type(name, context)
        rent = estimated_rent(property_type, place, coordinates[1], coordinates[0])
        source_id = f"mapbox-{feature.get('id', hashlib.sha1(str(feature).encode()).hexdigest()[:10])}"
        now = utc_now()

        return Property(
            _id=source_id,
            title=f"{name} near {place}",
            source_platform=SourcePlatform.mapbox,
            source_url=None,
            property_type=property_type,
            rent=rent,
            deposit=rent,
            area_sqft=160 if property_type in {"PG", "hostel", "co-living"} else 500,
            furnishing="verification needed",
            images=[],
            amenities=["Mapbox search lead", "price needs verification", "India geocoded"],
            location=GeoPoint(coordinates=(float(coordinates[0]), float(coordinates[1]))),
            locality_id=stable_locality_id(place),
            nearby_metro="Nearest transit TBD",
            commute_estimate_minutes=None,
            dedupe_key=source_id,
            price_history=[PriceObservation(source=SourcePlatform.mapbox, rent=rent)],
            lowest_price=PriceObservation(source=SourcePlatform.mapbox, rent=rent),
            created_at=now,
            updated_at=now,
        )

    def _property_type(self, name: str, context: str) -> str:
        text = f"{name} {context}".lower()
        if "pg" in text or "paying guest" in text:
            return "PG"
        if "hostel" in text:
            return "hostel"
        if "co" in text and "living" in text:
            return "co-living"
        if "apartment" in text or "flat" in text:
            return "apartment"
        return "property lead"


def estimated_rent(property_type: str, place: str, lat: float | None, lon: float | None) -> int:
    base_by_type = {"PG": 9500, "hostel": 8500, "co-living": 11000, "shared flat": 12000, "apartment": 15500}
    base = base_by_type.get(property_type, 12500)
    place_factor = 1.08 if any(term in place.lower() for term in ["sector v", "salt lake", "indiranagar", "bandra"]) else 1
    geo_noise = 0
    if lat and lon:
        geo_noise = int(abs(cos(radians(lat + lon))) * 2200)
    return round((base * place_factor + geo_noise) / 500) * 500


def stable_locality_id(place: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in place).strip("-")
    digest = hashlib.sha1(place.encode()).hexdigest()[:6]
    return f"open-{slug}-{digest}"
