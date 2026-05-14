from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_mongo() -> None:
    global client, database
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    database = client[settings.MONGODB_DB]
    await ensure_indexes(database)


async def close_mongo() -> None:
    if client:
        client.close()


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("MongoDB has not been initialized")
    return database


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.properties.create_index([("location", "2dsphere")])
    await db.properties.create_index([("dedupe_key", 1)], unique=True)
    await db.properties.create_index([("locality_id", 1), ("rent", 1)])
    await db.localities.create_index([("location", "2dsphere")])
    await db.localities.create_index([("slug", 1)], unique=True)
    await db.negotiated_rents.create_index([("property_id", 1), ("created_at", -1)])
    await db.reviews.create_index([("locality_id", 1), ("source", 1)])
    await db.ai_summaries.create_index([("entity_type", 1), ("entity_id", 1)], unique=True)
