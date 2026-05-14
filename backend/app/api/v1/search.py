from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

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
    key = cache_key("ai_search", {"query": query})
    cached = await get_json(key)
    if cached:
        return cached

    intent: SearchIntent = await IntentParser().parse(query)
    property_repo = PropertyRepository(db)
    locality_repo = LocalityRepository(db)
    properties = await property_repo.search(intent.filters)
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
        "recommendations": [item.model_dump() for item in recommendations],
        "properties": [serialize_doc(item) for item in enriched],
    }
    await set_json(key, result, ttl_seconds=300)
    return result


def serialize_doc(doc: dict) -> dict:
    output = dict(doc)
    output["_id"] = str(output["_id"])
    return output
