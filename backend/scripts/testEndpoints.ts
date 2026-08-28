import axios from "axios";

const BASE_URL = process.env.API_URL || "http://localhost:8001";

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs, details: details || undefined });
    console.log(`✅ [PASS] ${name} (${durationMs}ms)${details ? ` - ${details}` : ""}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message;
    results.push({ name, passed: false, durationMs, error: errorMsg });
    console.error(`❌ [FAIL] ${name} (${durationMs}ms): ${errorMsg}`);
  }
}

async function main() {
  console.log(`\n🧪 Running Comprehensive Backend Integration Test Suite against ${BASE_URL}\n`);

  // 1. Health Check
  await runTest("Health Check (GET /health)", async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    if (res.status !== 200 || res.data?.status !== "ok") {
      throw new Error(`Unexpected health response: ${JSON.stringify(res.data)}`);
    }
    return "Status is ok";
  });

  // 2. List Localities
  let sampleLocalityId = "";
  await runTest("List Localities (GET /api/v1/localities)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/localities?city=Kolkata`);
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Expected non-empty localities array, got ${JSON.stringify(res.data)}`);
    }
    sampleLocalityId = res.data[0]._id;
    return `Found ${res.data.length} localities (${res.data.map((l: any) => l.name).join(", ")})`;
  });

  // 3. Get Locality by ID
  await runTest(`Get Locality Details (GET /api/v1/localities/${sampleLocalityId})`, async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/localities/${sampleLocalityId}`);
    if (res.status !== 200 || res.data?._id !== sampleLocalityId) {
      throw new Error(`Locality lookup failed: ${JSON.stringify(res.data)}`);
    }
    return `Locality: ${res.data.name}, Score: ${res.data.scores?.overall}`;
  });

  // 4. Locality 404
  await runTest("Locality Not Found 404 (GET /api/v1/localities/nonexistent-slug-xyz)", async () => {
    try {
      await axios.get(`${BASE_URL}/api/v1/localities/nonexistent-slug-xyz`);
      throw new Error("Expected 404 but got 200");
    } catch (err: any) {
      if (err.response?.status === 404) {
        return "Correctly received 404 Not Found";
      }
      throw err;
    }
  });

  // 5. List Properties
  let samplePropertyId = "";
  await runTest("List Properties (GET /api/v1/properties)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties?budget_max=20000`);
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Expected non-empty properties array, got ${JSON.stringify(res.data)}`);
    }
    samplePropertyId = res.data[0]._id;
    return `Found ${res.data.length} properties under 20k (cheapest: Rs ${res.data[0].rent})`;
  });

  // 6. Get Property by ID
  await runTest(`Get Property Details (GET /api/v1/properties/${samplePropertyId})`, async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties/${samplePropertyId}`);
    if (res.status !== 200 || res.data?._id !== samplePropertyId) {
      throw new Error(`Property lookup failed: ${JSON.stringify(res.data)}`);
    }
    return `Property: ${res.data.title}, Rent: Rs ${res.data.rent}, Lowest: Rs ${res.data.lowest_price?.rent}`;
  });

  // 7. Property 404
  await runTest("Property Not Found 404 (GET /api/v1/properties/000000000000000000000000)", async () => {
    try {
      await axios.get(`${BASE_URL}/api/v1/properties/000000000000000000000000`);
      throw new Error("Expected 404 but got 200");
    } catch (err: any) {
      if (err.response?.status === 404) {
        return "Correctly received 404 Not Found";
      }
      throw err;
    }
  });

  // 8. Open Data Properties
  await runTest("Open Data Properties (GET /api/v1/properties/open-data)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties/open-data?place=Sector%20V%20Kolkata&limit=5`);
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Open data fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Retrieved ${res.data.length} leads`;
  });

  // 9. Open Data Sources Info
  await runTest("Open Data Sources Info (GET /api/v1/properties/open-data/sources)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties/open-data/sources`);
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Sources fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Available sources: ${res.data.map((s: any) => s.id).join(", ")}`;
  });

  // 10. Multi-Portal Property Aggregation
  await runTest("Aggregate Multi-Source Properties (GET /api/v1/properties/aggregate)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties/aggregate?place=Sector%20V%20Kolkata&limit=6`);
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Aggregation fetch failed: ${JSON.stringify(res.data)}`);
    }
    const sources = Array.from(new Set(res.data.map((p: any) => p.source_platform)));
    return `Aggregated ${res.data.length} properties across [${sources.join(", ")}]`;
  });

  // 11. Aggregate Sources Info
  await runTest("Aggregate Sources Metadata (GET /api/v1/properties/aggregate/sources)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/properties/aggregate/sources`);
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`Aggregate sources failed: ${JSON.stringify(res.data)}`);
    }
    return `Supported aggregators: ${res.data.map((s: any) => s.name).join(", ")}`;
  });

  // 12. Commute Estimation
  await runTest("Commute Estimation (POST /api/v1/commute/estimate)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/commute/estimate`, {
      origin: "Sector V",
      destination: "New Town Action Area I",
      modes: ["metro", "uber", "rapido", "bus"],
    });
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length !== 4) {
      throw new Error(`Commute estimate failed: ${JSON.stringify(res.data)}`);
    }
    const metro = res.data.find((m: any) => m.mode === "metro");
    return `4 modes estimated (Metro: ${metro?.minutes} mins, Rs ${metro?.monthly_cost}/mo)`;
  });

  // 13. AI Search with Intent, Geocoding & Ranking
  await runTest("AI Relocation Search (POST /api/v1/search)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/search`, {
      query: "peaceful 1bhk near sector v under 15k with metro and wifi",
    });
    if (res.status !== 200 || !res.data?.intent || !res.data?.recommendations) {
      throw new Error(`Search failed: ${JSON.stringify(res.data)}`);
    }
    const { intent, office_coordinates, recommendations, properties } = res.data;
    if (!office_coordinates || office_coordinates.length < 2) {
      throw new Error("Missing office coordinates in search output");
    }
    return `Office coordinates: [${office_coordinates}], Parsed budget: Rs ${intent.filters.budget_max}, Recommendations: ${recommendations.length}, Properties: ${properties.length}`;
  });

  // 14. Search Cache Hit Check
  await runTest("AI Search Redis Cache Hit (POST /api/v1/search - Cached)", async () => {
    const t0 = Date.now();
    const res = await axios.post(`${BASE_URL}/api/v1/search`, {
      query: "peaceful 1bhk near sector v under 15k with metro and wifi",
    });
    const elapsed = Date.now() - t0;
    if (res.status !== 200 || !res.data?.recommendations) {
      throw new Error("Cached search failed");
    }
    return `Cache response returned in ${elapsed}ms`;
  });

  // 15. AI Assistant Chat
  await runTest("AI Assistant Chat (POST /api/v1/assistant/chat)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/assistant/chat`, {
      message: "looking for flat near sector v budget 12k",
    });
    if (res.status !== 200 || !res.data?.answer || !res.data?.context) {
      throw new Error(`Assistant chat failed: ${JSON.stringify(res.data)}`);
    }
    return `Answer: "${res.data.answer}"`;
  });

  // 16. Submit Negotiated Rent
  await runTest("Submit Negotiated Rent (POST /api/v1/feedback/negotiated-rents)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/feedback/negotiated-rents`, {
      locality_id: "loc-sector-v",
      listed_rent: 14000,
      negotiated_rent: 12500,
      broker_commission: 6000,
      maintenance_charges: 800,
      hidden_costs: ["lift maintenance"],
    });
    if (res.status !== 200 || !res.data?._id || res.data.negotiated_rent !== 12500) {
      throw new Error(`Negotiated rent submission failed: ${JSON.stringify(res.data)}`);
    }
    return `Inserted ID: ${res.data._id}, Saved rent: Rs ${res.data.negotiated_rent}`;
  });

  // 17. Submit Locality Feedback
  await runTest("Submit Locality Feedback (POST /api/v1/feedback/locality)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/feedback/locality`, {
      locality_id: "loc-sector-v",
      category: "internet",
      score: 95,
      comment: "Airtel and Jio fiber are rock solid throughout Sector V",
    });
    if (res.status !== 200 || !res.data?._id || res.data.score !== 95) {
      throw new Error(`Locality feedback submission failed: ${JSON.stringify(res.data)}`);
    }
    return `Inserted ID: ${res.data._id}, Score: ${res.data.score}`;
  });

  // Summary
  console.log("\n=========================================");
  console.log("📊 TEST SUMMARY");
  console.log("=========================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error(`\n❌ ${failedCount} tests failed.`);
    process.exit(1);
  } else {
    console.log("\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test runner encountered critical error:", err);
  process.exit(1);
});
