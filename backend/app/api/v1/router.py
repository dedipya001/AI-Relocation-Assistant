from fastapi import APIRouter

from app.api.v1 import assistant, commute, feedback, localities, properties, search

api_router = APIRouter()
api_router.include_router(search.router, prefix="/search", tags=["ai-search"])
api_router.include_router(properties.router, prefix="/properties", tags=["properties"])
api_router.include_router(localities.router, prefix="/localities", tags=["localities"])
api_router.include_router(commute.router, prefix="/commute", tags=["commute"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
