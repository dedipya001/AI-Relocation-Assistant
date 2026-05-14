from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models.property import PropertyIn


@dataclass(frozen=True)
class ScrapeContext:
    city: str
    query: str
    max_pages: int = 3


class PropertySourceAdapter(ABC):
    source_name: str

    @abstractmethod
    async def fetch(self, context: ScrapeContext) -> list[PropertyIn]:
        """Fetch and normalize listings from an allowed source."""
