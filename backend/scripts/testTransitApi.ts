import assert from "node:assert/strict";
import axios from "axios";

const baseUrl = process.env.API_URL || "http://127.0.0.1:8001";

async function run() {
  const metro = await axios.get(`${baseUrl}/api/v1/transit/metro`, {
    params: { city: "Kolkata", lat: 22.5762, lon: 88.4335, limit: 3 },
  });
  assert.equal(metro.status, 200);
  assert(metro.data.lines.length >= 5);
  assert.equal(metro.data.nearest_stations[0].name, "Salt Lake Sector V");
  assert(metro.data.nearest_stations.every((item: any) => item.coordinate_precision));

  const bus = await axios.get(`${baseUrl}/api/v1/transit/bus`, {
    params: { city: "Bengaluru", lat: 12.9175, lon: 77.6227, limit: 3 },
  });
  assert.equal(bus.status, 200);
  assert(bus.data.routes.length >= 2);
  assert.equal(bus.data.nearest_stops[0].name, "Central Silk Board Bus Stop");

  const lifestyle = await axios.get(`${baseUrl}/api/v1/transit/lifestyle`, {
    params: { city: "Bengaluru", lat: 12.9346, lon: 77.6155, limit: 5 },
  });
  assert.equal(lifestyle.status, 200);
  assert(lifestyle.data.places.some((item: any) => item.name.includes("Ganbeii")));

  const hubs = await axios.get(`${baseUrl}/api/v1/transit/hubs`, {
    params: { city: "Pune", lat: 18.5913, lon: 73.7389, limit: 5 },
  });
  assert.equal(hubs.status, 200);
  assert.equal(hubs.data.hubs[0].name, "Rajiv Gandhi Infotech Park Hinjawadi");

  try {
    await axios.get(`${baseUrl}/api/v1/transit/metro`, { params: { city: "Kolkata", lat: 999, lon: 88 } });
    throw new Error("Expected invalid coordinates to fail");
  } catch (error: any) {
    assert.equal(error.response?.status, 400);
  }

  console.log("Transit metro, bus, lifestyle and hubs API routes passed.");
}

run().catch((error) => {
  console.error("Transit API test failed", error.response?.data || error);
  process.exit(1);
});
