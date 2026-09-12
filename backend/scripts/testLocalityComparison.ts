import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import { LocalityComparisonService } from "../src/services/localityComparison.js";

async function run() {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(config.MONGODB_DB);
    const service = new LocalityComparisonService(db);
    const result = await service.compare(
      ["loc-sector-v", "loc-new-town"],
      "Sector V IT Hub",
      [88.4335, 22.5762]
    );

    assert.equal(result.localities.length, 2, "Must compare exactly two localities");
    assert.equal(result.synthesis_mode, "deterministic", "CI without OpenAI key must use deterministic synthesis");

    const sectorV = result.localities.find((item) => item.locality_id === "loc-sector-v");
    const newTown = result.localities.find((item) => item.locality_id === "loc-new-town");
    assert(sectorV, "Sector V metric missing");
    assert(newTown, "New Town metric missing");

    assert.equal(sectorV.rent.sample_size, 1, "Sector V should use the seeded direct rent sample");
    assert.equal(sectorV.rent.median, 9500, "Sector V median should come from Mongo rent data");
    assert.equal(newTown.rent.median, 14500, "New Town median should come from Mongo rent data");
    assert.equal(newTown.rent.median_1bhk, 14500, "1BHK extraction should use title/property text");

    assert.equal(result.category_winners.affordability.locality_id, "loc-sector-v");
    assert.equal(result.category_winners.commute.locality_id, "loc-sector-v");
    assert.equal(result.category_winners.safety.locality_id, "loc-new-town");
    assert(result.category_winners.overall.locality_id, "Overall winner must be generated");

    assert(sectorV.commute.road_distance_km !== null, "Road-distance proxy should be available with workplace coordinates");
    assert.equal(sectorV.commute.road_distance_method, "haversine_x_1.18_road_proxy");
    assert(sectorV.commute.peak_morning_minutes !== null && sectorV.commute.off_peak_minutes !== null);
    assert(sectorV.commute.peak_morning_minutes! > sectorV.commute.off_peak_minutes!, "Peak commute must exceed off-peak estimate");

    for (const metric of result.localities) {
      assert.equal(metric.source_quality.infrastructure_is_proxy, true);
      assert(metric.infrastructure.methodology.every((line) => /proxy|not a utility-quality measurement/i.test(line)));
      assert(metric.scores.overall >= 0 && metric.scores.overall <= 100);
    }
    assert(/proxy/i.test(result.executive_tradeoff_analysis), "Executive analysis must disclose proxy infrastructure data");

    console.log("Locality comparison rent medians, commute estimates, winners and proxy disclosure passed.");
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("Locality comparison test failed", error);
  process.exit(1);
});
