from fastapi import APIRouter

from app.models.commute import CommuteEstimate
from app.services.commute import CommuteService

router = APIRouter()


@router.post("/estimate", response_model=list[CommuteEstimate])
async def estimate_commute(payload: dict) -> list[CommuteEstimate]:
    return await CommuteService().estimate(
        origin_name=payload.get("origin", "Selected locality"),
        destination=payload.get("destination", "Office"),
        modes=payload.get("modes"),
    )
