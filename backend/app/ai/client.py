from openai import AsyncOpenAI

from app.core.config import settings


def get_openai_client() -> AsyncOpenAI | None:
    if not settings.OPENAI_API_KEY:
        return None
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
