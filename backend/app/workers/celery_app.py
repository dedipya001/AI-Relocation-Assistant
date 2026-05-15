from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "relocation_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(task_track_started=True, task_serializer="json", result_serializer="json", accept_content=["json"])

celery_app.conf.beat_schedule = {
    "daily-property-scrape-kolkata": {
        "task": "scrape.properties.daily",
        "schedule": 24 * 60 * 60,
        "args": ("Kolkata",),
    }
}
