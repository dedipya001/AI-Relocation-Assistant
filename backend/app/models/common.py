from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def object_id_to_str(value: Any) -> str:
    return str(value)


PyObjectId = Annotated[str, BeforeValidator(object_id_to_str)]


class MongoModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId | None = Field(default=None, alias="_id")


class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: tuple[float, float]


class SourcePlatform(str, Enum):
    openstreetmap = "OpenStreetMap"
    mapbox = "Mapbox Search"
    housing = "Housing"
    magicbricks = "MagicBricks"
    acres99 = "99acres"
    nobroker = "NoBroker"
    broker_crm = "Broker CRM"
    rera = "RERA"
    apify = "Apify"
    brightdata = "BrightData"
    facebook = "Facebook"
    telegram = "Telegram"
    broker = "Local Broker"
    user = "User Submitted"


class TransportMode(str, Enum):
    metro = "metro"
    bus = "bus"
    walking = "walking"
    rapido = "rapido"
    uber = "uber"
    ola = "ola"
    cityflow = "cityflow"
    hexa = "hexa"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
