from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.mongo import close_mongo, connect_mongo
from app.db.redis import close_redis, connect_redis

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongo()
    await connect_redis()
    logger.info("api_started", environment=settings.ENVIRONMENT)
    yield
    await close_redis()
    await close_mongo()
    logger.info("api_stopped")


app = FastAPI(
    title="AI Relocation Intelligence API",
    version="0.1.0",
    description="AI-powered locality, commute, rent, and property intelligence platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
