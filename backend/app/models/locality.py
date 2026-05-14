from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import GeoPoint, MongoModel, utc_now


class LocalityScore(BaseModel):
    overall: float = Field(ge=0, le=100)
    women_safety: float = Field(ge=0, le=100)
    late_night: float = Field(ge=0, le=100)
    internet: float = Field(ge=0, le=100)
    food_access: float = Field(ge=0, le=100)
    commute_reliability: float = Field(ge=0, le=100)


class EssentialPlace(BaseModel):
    name: str
    category: str
    distance_meters: int
    rating: float | None = None


class LocalityBase(BaseModel):
    name: str
    slug: str
    city: str
    location: GeoPoint
    summary: str
    tags: list[str] = Field(default_factory=list)
    scores: LocalityScore
    essentials: list[EssentialPlace] = Field(default_factory=list)
    things_to_do: list[EssentialPlace] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class LocalityIn(LocalityBase):
    pass


class Locality(LocalityBase, MongoModel):
    pass
