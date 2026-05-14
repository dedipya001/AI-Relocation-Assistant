from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import MongoModel, utc_now


class NegotiatedRentIn(BaseModel):
    property_id: str | None = None
    locality_id: str
    listed_rent: int
    negotiated_rent: int
    broker_commission: int | None = None
    maintenance_charges: int | None = None
    hidden_costs: list[str] = Field(default_factory=list)


class NegotiatedRent(NegotiatedRentIn, MongoModel):
    created_at: datetime = Field(default_factory=utc_now)


class UserFeedbackIn(BaseModel):
    locality_id: str
    category: str
    score: float = Field(ge=0, le=100)
    comment: str | None = None


class UserFeedback(UserFeedbackIn, MongoModel):
    created_at: datetime = Field(default_factory=utc_now)
