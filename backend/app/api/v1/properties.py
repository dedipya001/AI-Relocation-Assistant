from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_database
from app.models.property import Property, PropertySearchFilters
from app.repositories.properties import PropertyRepository
from app.services.lowest_price import LowestPriceEngine

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


@router.get("/{property_id}", response_model=Property)
async def get_property(property_id: str, db: AsyncIOMotorDatabase = Depends(get_database)) -> Property:
    doc = await PropertyRepository(db).get(property_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Property not found")
    return Property.model_validate(LowestPriceEngine().attach_lowest_price(doc))
