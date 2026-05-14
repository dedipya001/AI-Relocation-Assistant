from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorCollection


class MongoRepository:
    collection_name: str

    def __init__(self, collection: AsyncIOMotorCollection):
        self.collection = collection

    async def get(self, item_id: str) -> dict[str, Any] | None:
        try:
            object_id = ObjectId(item_id)
        except (InvalidId, TypeError):
            object_id = item_id
        return await self.collection.find_one({"_id": object_id})

    async def list(self, query: dict[str, Any] | None = None, limit: int = 20) -> list[dict[str, Any]]:
        cursor = self.collection.find(query or {}).limit(limit)
        return await cursor.to_list(length=limit)

    async def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.collection.insert_one(payload)
        payload["_id"] = result.inserted_id
        return payload
