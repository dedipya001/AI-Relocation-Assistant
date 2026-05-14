from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import MongoRepository


class LocalityRepository(MongoRepository):
    collection_name = "localities"

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db[self.collection_name])

    async def find_by_slugs(self, slugs: list[str]) -> list[dict[str, Any]]:
        if not slugs:
            return []
        cursor = self.collection.find({"slug": {"$in": slugs}})
        return await cursor.to_list(length=len(slugs))

    async def top_for_city(self, city: str, limit: int = 12) -> list[dict[str, Any]]:
        cursor = self.collection.find({"city": city}).sort("scores.overall", -1).limit(limit)
        return await cursor.to_list(length=limit)
