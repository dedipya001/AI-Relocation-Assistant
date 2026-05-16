import math

import httpx
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.db.mongo import get_database
from app.models.ai import AIRecommendation, SearchIntent
from app.repositories.localities import LocalityRepository
from app.repositories.properties import PropertyRepository
from app.services.cache import cache_key, get_json, set_json
from app.services.intent_parser import IntentParser
from app.services.lowest_price import LowestPriceEngine
from app.services.recommendations import RecommendationEngine

router = APIRouter()


@router.post("", response_model=dict)
async def ai_search(payload: dict[str, str], db: AsyncIOMotorDatabase = Depends(get_database)) -> dict:
    query = payload.get("query", "")
    key = cache_key("ai_search_v2", {"query": query})
    cached = await get_json(key)
    if cached:
        return cached

    intent: SearchIntent = await IntentParser().parse(query)
    property_repo = PropertyRepository(db)
    locality_repo = LocalityRepository(db)
    properties = await property_repo.search(intent.filters)

    office_coordinates = await resolve_office_coordinates(intent.filters.office_location) if intent.filters.office_location else None
    if office_coordinates:
        rank_by_office_proximity(properties, office_coordinates)
        properties = keep_nearby_relocation_options(properties)

    locality_ids = list({item["locality_id"] for item in properties})
    localities = await locality_repo.list({"_id": {"$in": locality_ids}}, limit=50) if locality_ids else []
    localities_by_id = {str(item["_id"]): item for item in localities}

    price_engine = LowestPriceEngine()
    enriched = [price_engine.attach_lowest_price(item) for item in properties]
    recommendations: list[AIRecommendation] = RecommendationEngine().rank(
        enriched,
        localities_by_id,
        intent.filters.preferences,
        intent.filters.budget_max,
    )
    result = {
        "intent": intent.model_dump(),
        "office_coordinates": list(office_coordinates) if office_coordinates else None,
        "recommendations": [item.model_dump() for item in recommendations],
        "properties": [serialize_doc(item) for item in enriched],
    }
    await set_json(key, result, ttl_seconds=300)
    return result


def serialize_doc(doc: dict) -> dict:
    output = dict(doc)
    output["_id"] = str(output["_id"])
    return output


async def resolve_office_coordinates(office_location: str | None) -> tuple[float, float] | None:
    if not office_location:
        return None

    known = known_office_coordinates(office_location)
    if known:
        return known

    if settings.MAPBOX_ACCESS_TOKEN:
        coords = await geocode_with_mapbox(office_location, settings.MAPBOX_ACCESS_TOKEN)
        if coords:
            return coords

    coords = await geocode_with_nominatim(office_location)
    if coords:
        return coords

    if settings.DEFAULT_OFFICE_HINT and settings.DEFAULT_OFFICE_HINT.lower() != office_location.lower():
        known_default = known_office_coordinates(settings.DEFAULT_OFFICE_HINT)
        if known_default:
            return known_default
        return await geocode_with_nominatim(settings.DEFAULT_OFFICE_HINT)

    return None


def known_office_coordinates(office_location: str) -> tuple[float, float] | None:
    normalized = office_location.lower()
    if "candor" in normalized and "unitech" in normalized:
        return 88.4770, 22.5800
    if "sector v" in normalized or "salt lake" in normalized:
        return 88.4335, 22.5762
    if "new town" in normalized:
        return 88.4798, 22.5797
    return None


async def geocode_with_mapbox(query: str, token: str) -> tuple[float, float] | None:
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    params = {
        "access_token": token,
        "country": "in",
        "limit": 1,
        "autocomplete": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    features = payload.get("features") or []
    if not features:
        return None
    center = features[0].get("center") or []
    if len(center) < 2:
        return None
    return float(center[0]), float(center[1])


async def geocode_with_nominatim(query: str) -> tuple[float, float] | None:
    headers = {"User-Agent": settings.SCRAPER_USER_AGENT}
    params = {"q": f"{query}, India", "format": "jsonv2", "limit": 1, "countrycodes": "in"}
    try:
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            response = await client.get("https://nominatim.openstreetmap.org/search", params=params)
            response.raise_for_status()
            rows = response.json()
    except Exception:
        return None

    if not rows:
        return None
    lat = float(rows[0]["lat"])
    lon = float(rows[0]["lon"])
    return lon, lat


def rank_by_office_proximity(properties: list[dict], office_coordinates: tuple[float, float]) -> None:
    office_lon, office_lat = office_coordinates

    for item in properties:
        coords = ((item.get("location") or {}).get("coordinates") or [])
        if len(coords) >= 2:
            distance_km = haversine_km(office_lon, office_lat, float(coords[0]), float(coords[1]))
            item["distance_to_office_km"] = round(distance_km, 2)
            if not item.get("commute_estimate_minutes"):
                item["commute_estimate_minutes"] = max(6, int(distance_km * 4 + 8))
        else:
            item["distance_to_office_km"] = 999.0

    properties.sort(key=lambda item: (item.get("distance_to_office_km", 999.0), item.get("rent", 0)))


def keep_nearby_relocation_options(properties: list[dict], max_items: int = 40) -> list[dict]:
    if not properties:
        return properties

    nearest = sorted(properties, key=lambda item: item.get("distance_to_office_km", 999.0))
    anchor = nearest[0]
    anchor_city = (anchor.get("city") or "").strip().lower()

    nearby: list[dict] = []
    radius_km = 35.0
    for item in nearest:
        distance = float(item.get("distance_to_office_km", 999.0))
        item_city = (item.get("city") or "").strip().lower()

        city_matches = bool(anchor_city) and item_city == anchor_city
        is_near = distance <= radius_km
        if city_matches or is_near:
            nearby.append(item)

    if not nearby:
        nearby = nearest[:max_items]

    return nearby[:max_items]


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c
