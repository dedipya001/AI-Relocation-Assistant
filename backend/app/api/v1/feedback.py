from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_database
from app.models.feedback import NegotiatedRent, NegotiatedRentIn, UserFeedback, UserFeedbackIn

router = APIRouter()


@router.post("/negotiated-rents", response_model=NegotiatedRent)
async def submit_negotiated_rent(payload: NegotiatedRentIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> NegotiatedRent:
    doc = NegotiatedRent(**payload.model_dump()).model_dump(by_alias=True, exclude_none=True)
    result = await db.negotiated_rents.insert_one(doc)
    doc["_id"] = result.inserted_id
    return NegotiatedRent.model_validate(doc)


@router.post("/locality", response_model=UserFeedback)
async def submit_locality_feedback(payload: UserFeedbackIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> UserFeedback:
    doc = UserFeedback(**payload.model_dump()).model_dump(by_alias=True, exclude_none=True)
    result = await db.user_feedback.insert_one(doc)
    doc["_id"] = result.inserted_id
    return UserFeedback.model_validate(doc)
