from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import GeoPoint, MongoModel, SourcePlatform, utc_now


class PriceObservation(BaseModel):
    source: SourcePlatform
    rent: int
    url: str | None = None
    observed_at: datetime = Field(default_factory=utc_now)


class PropertyBase(BaseModel):
    title: str
    source_platform: SourcePlatform
    source_url: str | None = None
    property_type: str
    rent: int
    deposit: int | None = None
    area_sqft: int | None = None
    furnishing: str | None = None
    images: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    location: GeoPoint
    locality_id: str
    nearby_metro: str | None = None
    commute_estimate_minutes: int | None = None
    dedupe_key: str
    price_history: list[PriceObservation] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PropertyIn(PropertyBase):
    pass


class Property(PropertyBase, MongoModel):
    lowest_price: PriceObservation | None = None
    average_negotiated_rent: int | None = None
    estimated_fair_rent: int | None = None


class PropertySearchFilters(BaseModel):
    office_location: str | None = None
    budget_max: int | None = None
    property_types: list[str] = Field(default_factory=list)
    locality_ids: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    transport_modes: list[str] = Field(default_factory=list)
    preferences: list[str] = Field(default_factory=list)
