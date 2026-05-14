from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "local"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "relocation_ai"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    GOOGLE_MAPS_API_KEY: str | None = None
    MAPBOX_ACCESS_TOKEN: str | None = None

    RATE_LIMIT_PER_MINUTE: int = 60
    SCRAPER_USER_AGENT: str = "RelocationAIResearchBot/0.1"
    SCRAPER_PROXY_URL: str | None = None

    DEFAULT_CITY: str = "Kolkata"
    DEFAULT_OFFICE_HINT: str = "Sector V, Salt Lake, Kolkata"

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_URL.split(",") if origin.strip()]

    @property
    def cache_prefix(self) -> str:
        return f"relocation:{self.ENVIRONMENT}"


settings = Settings()
