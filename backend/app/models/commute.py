from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import MongoModel, TransportMode, utc_now


class CommuteEstimate(BaseModel):
    mode: TransportMode
    minutes: int
    monthly_cost: int
    reliability_score: float = Field(ge=0, le=100)
    peak_delay_minutes: int
    route_summary: str


class CommuteData(MongoModel):
    origin_entity_type: str
    origin_entity_id: str
    destination: str
    estimates: list[CommuteEstimate]
    provider: str
    created_at: datetime = Field(default_factory=utc_now)
