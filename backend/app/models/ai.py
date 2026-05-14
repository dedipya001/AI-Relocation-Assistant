from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import MongoModel, utc_now
from app.models.property import PropertySearchFilters


class SearchIntent(BaseModel):
    query: str
    filters: PropertySearchFilters
    inferred_lifestyle: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)


class RecommendationScore(BaseModel):
    affordability: float
    commute: float
    safety: float
    internet: float
    food_access: float
    lifestyle_fit: float
    total: float
    explanation: str


class AIRecommendation(BaseModel):
    entity_type: str
    entity_id: str
    title: str
    locality_name: str | None = None
    score: RecommendationScore
    highlights: list[str] = Field(default_factory=list)
    tradeoffs: list[str] = Field(default_factory=list)


class AISummary(MongoModel):
    entity_type: str
    entity_id: str
    summary: str
    source_count: int
    model: str
    created_at: datetime = Field(default_factory=utc_now)
