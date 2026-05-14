import hashlib

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.models.property import PropertyIn
from app.repositories.properties import PropertyRepository
from app.scraping.sources.base import PropertySourceAdapter, ScrapeContext

logger = structlog.get_logger(__name__)


class ScrapingPipeline:
    def __init__(self, repository: PropertyRepository, adapters: list[PropertySourceAdapter]):
        self.repository = repository
        self.adapters = adapters

    async def run(self, context: ScrapeContext) -> dict[str, int]:
        inserted = 0
        for adapter in self.adapters:
            listings = await self._fetch_with_retry(adapter, context)
            for listing in listings:
                normalized = self._normalize(listing)
                await self.repository.upsert_by_dedupe_key(normalized.model_dump())
                inserted += 1
            logger.info("scrape_source_completed", source=adapter.source_name, count=len(listings))
        return {"processed": inserted}

    @retry(wait=wait_exponential(multiplier=1, min=2, max=30), stop=stop_after_attempt(3))
    async def _fetch_with_retry(self, adapter: PropertySourceAdapter, context: ScrapeContext) -> list[PropertyIn]:
        return await adapter.fetch(context)

    def _normalize(self, listing: PropertyIn) -> PropertyIn:
        if listing.dedupe_key:
            return listing
        key = hashlib.sha256(f"{listing.title}:{listing.rent}:{listing.location.coordinates}".encode()).hexdigest()
        return listing.model_copy(update={"dedupe_key": key})
