import hashlib
import json
from typing import Any

from app.core.config import settings
from app.db.redis import get_redis


def cache_key(namespace: str, payload: Any) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    return f"{settings.cache_prefix}:{namespace}:{digest}"


async def get_json(key: str) -> Any | None:
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    await get_redis().setex(key, ttl_seconds, json.dumps(value, default=str))
