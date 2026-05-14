from app.models.common import SourcePlatform
from app.models.property import PriceObservation


class LowestPriceEngine:
    def attach_lowest_price(self, property_doc: dict) -> dict:
        observations = [
            PriceObservation(source=property_doc["source_platform"], rent=property_doc["rent"], url=property_doc.get("source_url"))
        ]
        observations.extend(PriceObservation.model_validate(item) for item in property_doc.get("price_history", []))
        lowest = min(observations, key=lambda item: item.rent)
        property_doc["lowest_price"] = lowest.model_dump()
        property_doc["source_platform"] = SourcePlatform(property_doc["source_platform"])
        return property_doc
