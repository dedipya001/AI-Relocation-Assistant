from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_database
from app.models.property import Property, PropertySearchFilters
from app.repositories.properties import PropertyRepository
from app.services.lowest_price import LowestPriceEngine
from app.services.open_property_data import OpenPropertyDataService
from app.services.property_aggregation import ListingSourceInfo, PropertyAggregationService

router = APIRouter()


@router.get("", response_model=list[Property])
async def list_properties(
    budget_max: int | None = Query(default=None),
    property_type: list[str] = Query(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[Property]:
    filters = PropertySearchFilters(budget_max=budget_max, property_types=property_type)
    docs = await PropertyRepository(db).search(filters)
    return [Property.model_validate(LowestPriceEngine().attach_lowest_price(doc)) for doc in docs]


@router.get("/open-data", response_model=list[Property])
async def open_data_properties(
    place: str = Query(default="Sector V Kolkata"),
    limit: int = Query(default=25, ge=1, le=80),
    sources: list[str] = Query(default=[]),
) -> list[Property]:
    return await OpenPropertyDataService().fetch_property_leads(place=place, limit=limit, sources=sources)


@router.get("/open-data/sources", response_model=list[dict[str, str]])
async def open_data_sources() -> list[dict[str, str]]:
    return OpenPropertyDataService().available_sources()


@router.get("/aggregate", response_model=list[Property])
async def aggregate_properties(
    place: str = Query(default="Sector V Kolkata"),
    limit: int = Query(default=40, ge=1, le=120),
    sources: list[str] = Query(default=[]),
) -> list[Property]:
    return await PropertyAggregationService().aggregate(place=place, limit=limit, sources=sources)


@router.get("/aggregate/sources", response_model=list[ListingSourceInfo])
async def aggregate_property_sources() -> list[ListingSourceInfo]:
    return PropertyAggregationService().sources()


@router.get("/{property_id}", response_model=Property)
async def get_property(property_id: str, db: AsyncIOMotorDatabase = Depends(get_database)) -> Property:
    doc = await PropertyRepository(db).get(property_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Property not found")
    return Property.model_validate(LowestPriceEngine().attach_lowest_price(doc))
