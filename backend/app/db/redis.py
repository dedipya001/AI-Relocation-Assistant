import redis.asyncio as redis

from app.core.config import settings

redis_client: redis.Redis | None = None


async def connect_redis() -> None:
    global redis_client
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    await redis_client.ping()


async def close_redis() -> None:
    if redis_client:
        await redis_client.aclose()


def get_redis() -> redis.Redis:
    if redis_client is None:
        raise RuntimeError("Redis has not been initialized")
    return redis_client
