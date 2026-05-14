import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


NOW = datetime.now(timezone.utc)

LOCALITIES = [
    {
        "_id": "loc-sector-v",
        "name": "Sector V",
        "slug": "sector-v",
        "city": "Kolkata",
        "location": {"type": "Point", "coordinates": [88.4335, 22.5762]},
        "summary": "Dense office district with short commutes, strong food access, and higher weekday traffic.",
        "tags": ["tech workers", "metro connectivity", "food access", "fast internet"],
        "scores": {
            "overall": 78,
            "women_safety": 72,
            "late_night": 68,
            "internet": 86,
            "food_access": 92,
            "commute_reliability": 80,
        },
        "essentials": [
            {"name": "Karunamoyee Market", "category": "grocery", "distance_meters": 950, "rating": 4.2},
            {"name": "AMRI Salt Lake", "category": "hospital", "distance_meters": 2200, "rating": 4.1},
        ],
        "things_to_do": [
            {"name": "Nicco Park", "category": "attraction", "distance_meters": 1600, "rating": 4.3}
        ],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "_id": "loc-new-town",
        "name": "New Town",
        "slug": "new-town",
        "city": "Kolkata",
        "location": {"type": "Point", "coordinates": [88.4798, 22.5797]},
        "summary": "Planned locality with newer housing, cafes, parks, and better value, but rain and traffic can affect commutes.",
        "tags": ["planned locality", "parks", "affordable rentals", "cafes"],
        "scores": {
            "overall": 82,
            "women_safety": 78,
            "late_night": 74,
            "internet": 84,
            "food_access": 80,
            "commute_reliability": 72,
        },
        "essentials": [
            {"name": "Axis Mall", "category": "mall", "distance_meters": 1200, "rating": 4.4},
            {"name": "Tata Medical Center", "category": "hospital", "distance_meters": 2600, "rating": 4.5},
        ],
        "things_to_do": [
            {"name": "Eco Park", "category": "park", "distance_meters": 3100, "rating": 4.5}
        ],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "_id": "loc-lake-town",
        "name": "Lake Town",
        "slug": "lake-town",
        "city": "Kolkata",
        "location": {"type": "Point", "coordinates": [88.4020, 22.6043]},
        "summary": "Residential, calmer than office hubs, with good food streets and moderate commute to Sector V.",
        "tags": ["peaceful", "food access", "residential", "shared flats"],
        "scores": {
            "overall": 76,
            "women_safety": 75,
            "late_night": 66,
            "internet": 78,
            "food_access": 84,
            "commute_reliability": 70,
        },
        "essentials": [
            {"name": "Lake Town Market", "category": "grocery", "distance_meters": 600, "rating": 4.1}
        ],
        "things_to_do": [
            {"name": "Lake Town Clock Tower", "category": "landmark", "distance_meters": 700, "rating": 4.0}
        ],
        "created_at": NOW,
        "updated_at": NOW,
    },
]

PROPERTIES = [
    {
        "title": "Furnished PG near Wipro More",
        "source_platform": "Housing",
        "source_url": "https://example.com/housing/pg-sector-v",
        "property_type": "PG",
        "rent": 9500,
        "deposit": 9500,
        "area_sqft": 120,
        "furnishing": "furnished",
        "images": ["/sample-room-1.jpg"],
        "amenities": ["wifi", "meals", "laundry", "metro connectivity"],
        "location": {"type": "Point", "coordinates": [88.434, 22.576]},
        "locality_id": "loc-sector-v",
        "nearby_metro": "Sector V",
        "commute_estimate_minutes": 8,
        "dedupe_key": "sector-v-pg-wipro-more",
        "price_history": [
            {"source": "MagicBricks", "rent": 10200, "url": "https://example.com/magicbricks/pg-sector-v", "observed_at": NOW},
            {"source": "99acres", "rent": 9800, "url": "https://example.com/99acres/pg-sector-v", "observed_at": NOW},
        ],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "title": "1BHK in New Town Action Area I",
        "source_platform": "MagicBricks",
        "source_url": "https://example.com/magicbricks/new-town-1bhk",
        "property_type": "apartment",
        "rent": 14500,
        "deposit": 29000,
        "area_sqft": 520,
        "furnishing": "semi-furnished",
        "images": ["/sample-room-2.jpg"],
        "amenities": ["lift", "security", "power backup", "fast internet"],
        "location": {"type": "Point", "coordinates": [88.481, 22.58]},
        "locality_id": "loc-new-town",
        "nearby_metro": "Salt Lake Sector V",
        "commute_estimate_minutes": 28,
        "dedupe_key": "new-town-aa1-1bhk",
        "price_history": [
            {"source": "Housing", "rent": 15000, "url": "https://example.com/housing/new-town-1bhk", "observed_at": NOW}
        ],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "title": "Shared Flat in Lake Town",
        "source_platform": "Facebook",
        "source_url": "https://example.com/facebook/lake-town-shared",
        "property_type": "shared flat",
        "rent": 11000,
        "deposit": 11000,
        "area_sqft": 180,
        "furnishing": "furnished",
        "images": ["/sample-room-3.jpg"],
        "amenities": ["wifi", "kitchen", "peaceful", "food access"],
        "location": {"type": "Point", "coordinates": [88.402, 22.604]},
        "locality_id": "loc-lake-town",
        "nearby_metro": "Belgachia",
        "commute_estimate_minutes": 38,
        "dedupe_key": "lake-town-shared-flat",
        "price_history": [],
        "created_at": NOW,
        "updated_at": NOW,
    },
]

NEGOTIATED_RENTS = [
    {"property_id": None, "locality_id": "loc-sector-v", "listed_rent": 10000, "negotiated_rent": 9200, "broker_commission": 0, "maintenance_charges": 0, "hidden_costs": ["electricity extra"], "created_at": NOW},
    {"property_id": None, "locality_id": "loc-new-town", "listed_rent": 15000, "negotiated_rent": 13700, "broker_commission": 7000, "maintenance_charges": 1200, "hidden_costs": ["move-in fee"], "created_at": NOW},
]


async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]
    await db.localities.delete_many({})
    await db.properties.delete_many({})
    await db.negotiated_rents.delete_many({})
    await db.localities.insert_many(LOCALITIES)
    await db.properties.insert_many(PROPERTIES)
    await db.negotiated_rents.insert_many(NEGOTIATED_RENTS)
    print("Seeded localities, properties, and negotiated rent examples.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
