from statistics import mean

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.base import MongoRepository


class NegotiatedRentRepository(MongoRepository):
    collection_name = "negotiated_rents"

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db[self.collection_name])

    async def average_for_property(self, property_id: str) -> int | None:
        docs = await self.collection.find({"property_id": property_id}).to_list(length=100)
        if not docs:
            return None
        return round(mean(doc["negotiated_rent"] for doc in docs))

    async def average_for_locality(self, locality_id: str) -> int | None:
        docs = await self.collection.find({"locality_id": locality_id}).to_list(length=500)
        if not docs:
            return None
        return round(mean(doc["negotiated_rent"] for doc in docs))
