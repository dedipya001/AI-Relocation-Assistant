from app.workers.celery_app import celery_app


@celery_app.task(name="scrape.properties")
def scrape_properties_task(source: str, city: str, place: str | None = None) -> dict:
    return {
        "source": source,
        "city": city,
        "place": place or city,
        "status": "queued",
        "ingestion_methods": ["Apify", "BrightData", "Playwright", "partner_feed"],
    }


@celery_app.task(name="scrape.properties.daily")
def daily_property_scrape_task(city: str = "Kolkata") -> dict:
    sources = ["magicbricks", "99acres", "nobroker", "broker_crm"]
    return {"city": city, "sources": sources, "status": "scheduled"}


@celery_app.task(name="summarize.locality")
def summarize_locality_task(locality_id: str) -> dict:
    return {"locality_id": locality_id, "status": "queued"}
