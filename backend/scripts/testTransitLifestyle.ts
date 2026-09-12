import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import {
  DATASET_VERIFIED_AT,
  METRO_LINES,
  PROXIMITY_POINTS,
} from "../src/data/transitAndLifestyle.js";
import { TransitAndLifestyleService } from "../src/services/transitAndLifestyleService.js";

async function run() {
  const line = (id: string) => METRO_LINES.find((item) => item.id === id);

  assert.equal(line("kol-green")?.stations.length, 12, "Kolkata Green Line should contain 12 stations");
  assert.equal(line("kol-orange")?.stations.length, 24, "Kolkata Orange catalogue should retain full airport corridor");
  assert.equal(line("kol-orange")?.operational_stations?.length, 9, "Orange operational segment should be kept separate");
  assert.equal(line("blr-yellow")?.stations.length, 16, "Bengaluru Yellow Line should contain 16 stations");
  assert.equal(line("blr-yellow")?.status, "operational");
  assert.equal(line("blr-blue")?.status, "under_construction", "Blue Line must not be falsely presented as operational");
  assert.equal(line("mum-line-1")?.stations.length, 12, "Mumbai Line 1 should contain 12 stations");
  assert.equal(line("mum-aqua")?.stations.length, 27, "Mumbai Line 3 statutory corridor should contain 27 stations");
  assert.equal(line("pune-line-3")?.stations.length, 23, "Pune Line 3 should contain the official 23-station corridor");
  assert.equal(line("pune-line-3")?.status, "under_construction", "Pune Line 3 must retain current project status");

  const delhiOperational = METRO_LINES.filter((item) => item.city === "Delhi NCR" && item.status === "operational");
  for (const required of ["del-red", "del-yellow", "del-blue-main", "del-pink", "del-magenta", "del-airport", "noida-aqua", "gurugram-rapid"]) {
    assert(delhiOperational.some((item) => item.id === required), `Missing Delhi NCR operational network ${required}`);
  }

  assert(PROXIMITY_POINTS.length > 20, "Proximity catalogue should cover multiple cities");
  assert(PROXIMITY_POINTS.every((point) => Boolean(point.coordinate_precision)), "Every map point must disclose coordinate precision");

  const service = new TransitAndLifestyleService();
  const sectorV = service.listMetro({ city: "Kolkata", lat: 22.5762, lon: 88.4335, limit: 3 });
  assert.equal(sectorV.dataset_verified_at, DATASET_VERIFIED_AT);
  assert.equal(sectorV.nearest_stations[0]?.name, "Salt Lake Sector V");
  assert.equal(sectorV.nearest_stations[0]?.distance_km, 0);
  assert(sectorV.nearest_stations[1]?.distance_km !== null);

  const buses = service.listBus({ city: "Bengaluru", lat: 12.9175, lon: 77.6227, limit: 3 });
  assert(buses.routes.some((route) => route.operator === "BMTC"));
  assert.equal(buses.nearest_stops[0]?.name, "Central Silk Board Bus Stop");

  const lifestyle = service.listLifestyle({ city: "Bengaluru", lat: 12.9346, lon: 77.6155, limit: 5 });
  assert(lifestyle.places.some((place) => place.name.includes("Ganbeii")));
  assert(lifestyle.places.every((place) => place.walking_minutes !== null));

  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const localities = await client.db(config.MONGODB_DB).collection("localities").find({}).toArray();
    assert(localities.length >= 10, "Expected base and multi-city locality seed data");
    for (const locality of localities) {
      assert(locality.transit_lifestyle, `Missing transit/lifestyle enrichment for ${locality.name}`);
      assert.equal(locality.transit_lifestyle.dataset_verified_at, DATASET_VERIFIED_AT);
      assert.equal(typeof locality.transit_lifestyle.city, "string");
      assert(Array.isArray(locality.transit_lifestyle.metro_lines));
      assert(Array.isArray(locality.transit_lifestyle.nearest_metro));
      assert(Array.isArray(locality.transit_lifestyle.nearest_bus));
      assert(Array.isArray(locality.transit_lifestyle.nearby_lifestyle));
      assert(Array.isArray(locality.transit_lifestyle.nearby_tech_hubs));
    }
  } finally {
    await client.close();
  }

  console.log("Transit/lifestyle networks, proximity calculations, status truthfulness and seed enrichment passed.");
}

run().catch((error) => {
  console.error("Transit/lifestyle test failed", error);
  process.exit(1);
});
