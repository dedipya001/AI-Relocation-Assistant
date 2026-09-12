import assert from "node:assert/strict";
import axios from "axios";

const baseUrl = process.env.API_URL || "http://127.0.0.1:8001";

async function run() {
  const post = await axios.post(`${baseUrl}/api/v1/localities/compare`, {
    localities: ["loc-sector-v", "loc-new-town"],
    workplace: "Sector V IT Hub",
    workplace_coordinates: [88.4335, 22.5762],
  });
  assert.equal(post.status, 200);
  assert.equal(post.data.localities.length, 2);
  assert(post.data.category_winners?.overall?.locality_id);
  assert.equal(post.data.workplace_coordinates[0], 88.4335);

  const get = await axios.get(`${baseUrl}/api/v1/localities/compare`, {
    params: {
      localities: "loc-sector-v,loc-new-town",
      workplace: "Sector V",
    },
  });
  assert.equal(get.status, 200);
  assert.equal(get.data.localities.length, 2);
  assert(get.data.localities.every((item: any) => item.source_quality?.infrastructure_is_proxy === true));

  try {
    await axios.post(`${baseUrl}/api/v1/localities/compare`, {
      localities: ["loc-sector-v"],
      workplace: "Sector V",
      workplace_coordinates: [88.4335, 22.5762],
    });
    throw new Error("Expected invalid single-locality request to fail");
  } catch (error: any) {
    assert.equal(error.response?.status, 400);
  }

  console.log("Locality comparison GET/POST API routes passed.");
}

run().catch((error) => {
  console.error("Locality comparison API test failed", error.response?.data || error);
  process.exit(1);
});
