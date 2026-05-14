from app.workers.celery_app import celery_app


@celery_app.task(name="scrape.properties")
def scrape_properties_task(source: str, city: str) -> dict:
    return {"source": source, "city": city, "status": "queued"}


@celery_app.task(name="summarize.locality")
def summarize_locality_task(locality_id: str) -> dict:
    return {"locality_id": locality_id, "status": "queued"}
