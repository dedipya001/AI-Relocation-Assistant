from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.db.mongo import get_database
from app.models.locality import Locality
from app.repositories.localities import LocalityRepository

router = APIRouter()


@router.get("", response_model=list[Locality])
async def list_localities(
    city: str = Query(default=settings.DEFAULT_CITY),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[Locality]:
    docs = await LocalityRepository(db).top_for_city(city)
    return [Locality.model_validate(doc) for doc in docs]


@router.get("/{locality_id}", response_model=Locality)
async def get_locality(locality_id: str, db: AsyncIOMotorDatabase = Depends(get_database)) -> Locality:
    doc = await LocalityRepository(db).get(locality_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Locality not found")
    return Locality.model_validate(doc)
