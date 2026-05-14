from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.v1.search import ai_search
from app.db.mongo import get_database

router = APIRouter()


@router.post("/chat", response_model=dict)
async def chat(payload: dict, db: AsyncIOMotorDatabase = Depends(get_database)) -> dict:
    message = payload.get("message", "")
    search_result = await ai_search({"query": message}, db)
    top = search_result["recommendations"][:3]
    if not top:
        answer = "I need a little more detail to recommend areas. Share office location, budget, commute preference, and must-haves."
    else:
        names = ", ".join(item["title"] for item in top)
        answer = f"I found {len(top)} strong options: {names}. I ranked them by commute, affordability, safety, internet, and lifestyle fit."
    return {"answer": answer, "context": search_result}
