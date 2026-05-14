from app.models.property import PropertyIn
from app.scraping.sources.base import PropertySourceAdapter, ScrapeContext


class MarketplaceAdapter(PropertySourceAdapter):
    def __init__(self, source_name: str):
        self.source_name = source_name

    async def fetch(self, context: ScrapeContext) -> list[PropertyIn]:
        # Production adapters should use official APIs, partner feeds, or ToS-compliant scraping.
        # This placeholder keeps the pipeline contract stable while integrations are added.
        return []


HousingAdapter = lambda: MarketplaceAdapter("Housing")
MagicBricksAdapter = lambda: MarketplaceAdapter("MagicBricks")
Acres99Adapter = lambda: MarketplaceAdapter("99acres")
