import re

from app.core.config import settings
from app.models.ai import SearchIntent
from app.models.property import PropertySearchFilters


PROPERTY_KEYWORDS = {
    "pg": "PG",
    "hostel": "hostel",
    "co-living": "co-living",
    "coliving": "co-living",
    "shared": "shared flat",
    "flat": "apartment",
    "apartment": "apartment",
}

PREFERENCE_KEYWORDS = {
    "peaceful": "peaceful",
    "safe": "safety",
    "female": "women safety",
    "night": "late-night commute",
    "internet": "internet reliability",
    "food": "food access",
    "traffic": "low traffic",
    "metro": "metro connectivity",
}


class IntentParser:
    async def parse(self, query: str) -> SearchIntent:
        normalized = query.lower()
        budget = self._extract_budget(normalized)
        property_types = [label for keyword, label in PROPERTY_KEYWORDS.items() if keyword in normalized]
        preferences = [label for keyword, label in PREFERENCE_KEYWORDS.items() if keyword in normalized]
        transport_modes = [mode for mode in ["metro", "bus", "walking", "rapido", "uber", "ola"] if mode in normalized]

        filters = PropertySearchFilters(
            office_location=self._extract_office_location(query) or settings.DEFAULT_OFFICE_HINT,
            budget_max=budget,
            property_types=list(dict.fromkeys(property_types)),
            preferences=list(dict.fromkeys(preferences)),
            transport_modes=transport_modes,
        )
        follow_ups = []
        if not budget:
            follow_ups.append("What monthly rent budget should I optimize around?")
        if not transport_modes and "commute" in normalized:
            follow_ups.append("Which commute modes are acceptable for you?")
        return SearchIntent(query=query, filters=filters, inferred_lifestyle=preferences, follow_up_questions=follow_ups)

    def _extract_budget(self, query: str) -> int | None:
        match = re.search(r"(?:under|below|budget is|budget|upto|up to)\s*(\d+)\s*k?", query)
        if not match:
            return None
        amount = int(match.group(1))
        return amount * 1000 if amount < 1000 else amount

    def _extract_office_location(self, query: str) -> str | None:
        match = re.search(
            r"(?:work in|office in|near)\s+([A-Za-z0-9 ,.-]+?)(?:,| under| with| budget| for | so that | because |$)",
            query,
            re.I,
        )
        return match.group(1).strip() if match else None
