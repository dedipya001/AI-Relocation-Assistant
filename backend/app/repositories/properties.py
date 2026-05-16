from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.property import PropertySearchFilters
from app.repositories.base import MongoRepository


class PropertyRepository(MongoRepository):
    collection_name = "properties"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        super().__init__(db[self.collection_name])

    async def search(self, filters: PropertySearchFilters, limit: int = 40) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if filters.budget_max:
            query["rent"] = {"$lte": filters.budget_max}
        if filters.property_types:
            query["property_type"] = {"$in": filters.property_types}
        if filters.locality_ids:
            query["locality_id"] = {"$in": filters.locality_ids}
        if filters.amenities:
            query["amenities"] = {"$all": filters.amenities}

        collections = await self._property_collections()
        per_collection_limit = max(limit, 100)
        docs: list[dict[str, Any]] = []

        for coll in collections:
            cursor = coll.find(query).sort("rent", 1).limit(per_collection_limit)
            docs.extend(await cursor.to_list(length=per_collection_limit))

        docs.sort(key=lambda item: item.get("rent", 0))
        return docs[:limit]

    async def _property_collections(self) -> list[Any]:
        names = await self.db.list_collection_names()
        property_names = [name for name in names if name == self.collection_name or name.startswith("properties_")]
        if not property_names:
            return [self.collection]
        return [self.db[name] for name in sorted(property_names)]

    async def upsert_by_dedupe_key(self, payload: dict[str, Any]) -> dict[str, Any]:
        await self.collection.update_one(
            {"dedupe_key": payload["dedupe_key"]},
            {"$set": payload, "$setOnInsert": {"created_at": payload.get("created_at")}},
            upsert=True,
        )
        return await self.collection.find_one({"dedupe_key": payload["dedupe_key"]}) or payload
