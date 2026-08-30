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

  // 5. Compare Localities Head-to-Head
  await runTest("Compare Localities Head-to-Head (POST /api/v1/localities/compare)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/localities/compare`, {
      locality_ids: ["loc-new-town", "loc-sector-v", "loc-lake-town"],
      city: "Kolkata",
      workplace: "Candor TechSpace Gate 2, New Town",
    });
    if (res.status !== 200 || !Array.isArray(res.data?.localities) || res.data.localities.length !== 3) {
      throw new Error(`Locality comparison failed: ${JSON.stringify(res.data)}`);
    }
    const winners = res.data.category_winners;
    return `Compared ${res.data.localities.length} localities against ${res.data.workplace}. Budget Winner: ${winners?.affordability?.name}, Commute Winner: ${winners?.commute?.name}, Overall: ${winners?.overall?.name}`;
  });

  // 6. Real Metro Lines Network
  await runTest("All Metro Lines by City (GET /api/v1/transit/metro)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/transit/metro?city=Kolkata`);
    if (res.status !== 200 || !Array.isArray(res.data?.lines) || res.data.lines.length === 0) {
      throw new Error(`Metro lines fetch failed: ${JSON.stringify(res.data)}`);
    }
    const linesSummary = res.data.lines.map((l: any) => `${l.name} (${l.total_stations} stns, ${l.length_km}km)`).join(" | ");
    return `Found ${res.data.lines.length} metro lines for Kolkata: ${linesSummary}`;
  });

  // 7. Real Bus Routes
  await runTest("Real Bus Routes by City (GET /api/v1/transit/bus)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/transit/bus?city=Kolkata`);
    if (res.status !== 200 || !Array.isArray(res.data?.routes) || res.data.routes.length === 0) {
      throw new Error(`Bus routes fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Found ${res.data.routes.length} bus routes (e.g. ${res.data.routes.map((r: any) => r.route_number).join(", ")})`;
  });

  // 8. Cafes & Clubs Lifestyle Directory
  await runTest("Cafes & Clubs Lifestyle Directory (GET /api/v1/transit/lifestyle)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/transit/lifestyle?locality_id=loc-sector-v`);
    if (res.status !== 200 || !Array.isArray(res.data?.venues) || res.data.venues.length === 0) {
      throw new Error(`Lifestyle venues fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Found ${res.data.venues.length} venues in Sector V (e.g. ${res.data.venues.map((v: any) => `${v.name} [${v.category}]`).join(", ")})`;
  });

  // 9. Nearest Transit & Lifestyle Hubs
  await runTest("Nearest Transit & Lifestyle Hubs (POST /api/v1/transit/hubs)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/transit/hubs`, {
      coordinates: [88.4335, 22.5762], // Sector V SDF
      max_radius_km: 5.0,
    });
    if (res.status !== 200 || !Array.isArray(res.data?.metro_stations) || !Array.isArray(res.data?.cafes_nearby)) {
      throw new Error(`Nearest hubs search failed: ${JSON.stringify(res.data)}`);
    }
    const nearestMetro = res.data.metro_stations[0];
    const nearestCafe = res.data.cafes_nearby[0];
    const nearestClub = res.data.clubs_and_breweries[0];
    return `Nearest Metro: ${nearestMetro?.station_name} (${nearestMetro?.distance_km}km, ${nearestMetro?.line_name}), Cafe: ${nearestCafe?.venue?.name} (${nearestCafe?.distance_km}km), Club/Brewery: ${nearestClub?.venue?.name} (${nearestClub?.distance_km}km)`;
  });

  // 10. List Properties
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
      origin: "Tarulia Lane",
      destination: "Sector V, Salt Lake",
      modes: ["metro", "uber", "rapido", "bus"],
    });
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length !== 4) {
      throw new Error(`Commute estimate failed: ${JSON.stringify(res.data)}`);
    }
    const metro = res.data.find((m: any) => m.mode === "metro");
    return `4 modes estimated (Metro: ${metro?.minutes} mins, Rs ${metro?.monthly_cost}/mo, Dist: ${metro?.distance_km} km)`;
  });

  // 13. Time-of-Day Traffic Analytics
  await runTest("Diurnal Traffic Data by Time of Day (POST /api/v1/commute/traffic)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/commute/traffic`, {
      origin: "Tarulia Lane, Kolkata",
      destination: "Candor TechSpace, New Town",
      city: "Kolkata",
    });
    if (res.status !== 200 || !res.data?.traffic_data?.time_slots || !res.data?.traffic_data?.hourly_profile) {
      throw new Error(`Traffic data endpoint failed: ${JSON.stringify(res.data)}`);
    }
    const slots = res.data.traffic_data.time_slots;
    return `Dist: ${res.data.road_distance_km} km, Morning Peak: ${slots.morning_peak.driving_minutes}m (x${slots.morning_peak.multiplier}), Midday: ${slots.midday.driving_minutes}m, Evening Peak: ${slots.evening_peak.driving_minutes}m, 24h data points: ${res.data.traffic_data.hourly_profile.length}`;
  });

  // 14. Nearest Shuttle Services Routes (Cityflo, HexaH2O, ShuttleSpeed)
  await runTest("Nearest Shuttle Routes (Cityflo, HexaH2O, ShuttleSpeed) (POST /api/v1/commute/traffic)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/commute/traffic`, {
      origin: "Tarulia Lane PG, Kolkata",
      destination: "Candor TechSpace Gate 2, New Town",
      city: "Kolkata",
    });
    const shuttles = res.data?.shuttle_services;
    if (!Array.isArray(shuttles) || shuttles.length < 3) {
      throw new Error(`Shuttle services lookup failed: ${JSON.stringify(res.data)}`);
    }
    const services = shuttles.map((s: any) => `${s.service_name} (${s.pickup_distance_meters}m walk, Rs ${s.fare_per_ride_inr}/ride)`).join(", ");
    return `Found ${shuttles.length} shuttle options: ${services}`;
  });

  // 15. AI Search with Intent, Geocoding & Ranking
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

  // 18. Recommendations Profiles Endpoint
  await runTest("List Recommendation Profiles (GET /api/v1/recommendations/profiles)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/recommendations/profiles`);
    if (res.status !== 200 || !Array.isArray(res.data?.profiles) || res.data.profiles.length < 5) {
      throw new Error(`Failed to list scoring profiles: ${JSON.stringify(res.data)}`);
    }
    return `Supported personas: [${res.data.profiles.join(", ")}]`;
  });

  // 19. Evaluate Direct Ranking & Subscores
  await runTest("Evaluate Direct Ranking & Subscores (POST /api/v1/recommendations/rank)", async () => {
    const sampleProps = [
      {
        _id: "test-prop-1",
        title: "Test PG 1",
        rent: 9000,
        locality_id: "loc-sector-v",
        commute_estimate_minutes: 10,
        amenities: ["wifi", "meals"],
      },
      {
        _id: "test-prop-2",
        title: "Test Luxury 2BHK",
        rent: 28000,
        locality_id: "loc-new-town",
        commute_estimate_minutes: 35,
        amenities: ["lift", "pool"],
      },
    ];

    const res = await axios.post(`${BASE_URL}/api/v1/recommendations/rank`, {
      properties: sampleProps,
      profile: "budget_saver",
      hard_constraints: {
        max_budget: 20000,
      },
    });

    if (res.status !== 200 || !Array.isArray(res.data?.recommendations)) {
      throw new Error(`Rank endpoint failed: ${JSON.stringify(res.data)}`);
    }

    const [first, second] = res.data.recommendations;
    if (!first.score.subscores?.affordability || !first.score.explanation) {
      throw new Error("Missing subscores breakdown or explanation");
    }
    if (second.is_eligible !== false || second.constraint_violations.length === 0) {
      throw new Error("Expected 2nd property to fail hard budget constraint");
    }

    return `Rank #1 (${first.title}): score ${first.score.total}, Rank #2 marked ineligible (${second.constraint_violations[0]})`;
  });

  // 27. Root AdSense Verification File (GET /ads.txt)
  await runTest("Root AdSense Verification File (GET /ads.txt)", async () => {
    const res = await axios.get(`${BASE_URL}/ads.txt`);
    if (res.status !== 200 || !res.data.includes("google.com")) {
      throw new Error(`Invalid ads.txt response: ${res.data}`);
    }
    return `ads.txt verified with publisher format: ${res.data.trim()}`;
  });

  // 28. Search Engine Robots & Sitemap Directives (GET /robots.txt)
  await runTest("Search Engine Robots & Sitemap Directives (GET /robots.txt)", async () => {
    const res = await axios.get(`${BASE_URL}/robots.txt`);
    if (res.status !== 200 || !res.data.includes("Sitemap:")) {
      throw new Error(`Invalid robots.txt response: ${res.data}`);
    }
    return `robots.txt correctly declares sitemap directive: ${res.data.split("\n").filter((l: string) => l.startsWith("Sitemap"))[0]}`;
  });

  // 29. Dynamic XML Sitemap (GET /sitemap.xml)
  await runTest("Dynamic XML Sitemap (GET /sitemap.xml)", async () => {
    const res = await axios.get(`${BASE_URL}/sitemap.xml`);
    if (res.status !== 200 || !res.data.includes("<urlset") || !res.data.includes("thikanakhojo.com")) {
      throw new Error(`Invalid sitemap.xml response`);
    }
    const urlMatches = (res.data.match(/<loc>/g) || []).length;
    return `Sitemap successfully generated with ${urlMatches} indexed URLs targeting thikanakhojo.com`;
  });

  // 30. Brand Metadata & Support Email (GET /api/v1/seo/brand-metadata)
  await runTest("Brand Metadata & Support Email (GET /api/v1/seo/brand-metadata)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/seo/brand-metadata`);
    if (res.status !== 200 || res.data?.domain !== "thikanakhojo.com" || res.data?.contact_email !== "thikanakhojo@gmail.com") {
      throw new Error(`Brand metadata mismatch: ${JSON.stringify(res.data)}`);
    }
    return `Brand: ${res.data.site_name} (${res.data.domain}), Contact: ${res.data.contact_email}, Cities: ${res.data.supported_cities.join(", ")}`;
  });

  // 31. Rich Results Schema.org JSON-LD (GET /api/v1/seo/schema-org)
  await runTest("Rich Results Schema.org JSON-LD (GET /api/v1/seo/schema-org)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/seo/schema-org`);
    if (res.status !== 200 || !Array.isArray(res.data?.["@graph"])) {
      throw new Error(`Invalid Schema.org graph: ${JSON.stringify(res.data)}`);
    }
    const org = res.data["@graph"].find((i: any) => i["@type"] === "Organization");
    return `Structured Data: Organization "${org?.name}" with contact point "${org?.email}"`;
  });

  // 32. Ingest Ad Impression & Click Event (POST /api/v1/admin/ads/events)
  await runTest("Ingest Ad Click & Impression Events (POST /api/v1/admin/ads/events)", async () => {
    const resImp = await axios.post(`${BASE_URL}/api/v1/admin/ads/events`, {
      event_type: "impression",
      ad_slot: "header_banner",
      provider: "adsense",
      locality_id: "loc-sector-v",
      rpm_estimate_inr: 150.0,
    });
    const resClick = await axios.post(`${BASE_URL}/api/v1/admin/ads/events`, {
      event_type: "click",
      ad_slot: "locality_card_ad",
      provider: "adsense",
      locality_id: "loc-sector-v",
      cpc_estimate_inr: 28.0,
    });
    if (resImp.status !== 200 || resClick.status !== 200) {
      throw new Error(`Ad event logging failed`);
    }
    return `Recorded impression & click (Est revenue: ₹${resClick.data?.event?.estimated_revenue_inr})`;
  });

  // 33. Admin Dashboard Overview (GET /api/v1/admin/dashboard)
  await runTest("Admin Dashboard Overview (GET /api/v1/admin/dashboard)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/dashboard`);
    if (res.status !== 200 || !res.data?.executive_summary || !res.data?.api_costs) {
      throw new Error(`Admin dashboard payload invalid: ${JSON.stringify(res.data)}`);
    }
    const summary = res.data.executive_summary;
    return `Total Searches: ${summary.total_searches_processed}, API Spend: ₹${summary.total_api_spend_inr}, Ad Earnings: ₹${summary.total_ad_earnings_inr}, Net Profit: ₹${summary.net_profit_inr}`;
  });

  // 34. OpenAI Token Usage & Costs (GET /api/v1/admin/costs/openai)
  await runTest("OpenAI Token Usage & Costs (GET /api/v1/admin/costs/openai)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/costs/openai`);
    if (res.status !== 200 || !res.data?.summary) {
      throw new Error(`OpenAI costs endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    return `Tokens: ${res.data.summary.total_tokens_consumed.toLocaleString()}, Spend: ₹${res.data.summary.total_cost_inr} ($${res.data.summary.total_cost_usd})`;
  });

  // 35. Mapbox API Usage & Spend (GET /api/v1/admin/costs/mapbox)
  await runTest("Mapbox API Usage & Spend (GET /api/v1/admin/costs/mapbox)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/costs/mapbox`);
    if (res.status !== 200 || !res.data?.summary) {
      throw new Error(`Mapbox costs endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    return `Requests: ${res.data.summary.total_requests} (Free tier quota remaining: ${res.data.summary.remaining_free_requests})`;
  });

  // 36. Top Searched Localities & Demand (GET /api/v1/admin/trends/searches)
  await runTest("Top Searched Localities & Demand (GET /api/v1/admin/trends/searches)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/trends/searches`);
    if (res.status !== 200 || !Array.isArray(res.data?.top_searched_localities)) {
      throw new Error(`Search trends endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    const top = res.data.top_searched_localities[0];
    return `Top Locality: ${top.locality} (${top.city}) with ${top.search_volume} searches (${top.share_pct}%), Avg Budget: ₹${top.avg_budget_inr}/mo`;
  });

  // 37. Property Demand & Price Bands (GET /api/v1/admin/trends/demand)
  await runTest("Property Demand & Price Bands (GET /api/v1/admin/trends/demand)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/trends/demand`);
    if (res.status !== 200 || !Array.isArray(res.data?.high_demand_price_bands)) {
      throw new Error(`Demand trends endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    const topBand = res.data.high_demand_price_bands[1];
    return `Top Demand Price Band: ${topBand.band} (${topBand.demand_share_pct}% market share)`;
  });

  // 38. Feature Demand by Age Demographics (GET /api/v1/admin/trends/demographics)
  await runTest("Feature Demand by Age Demographics (GET /api/v1/admin/trends/demographics)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/trends/demographics`);
    if (res.status !== 200 || !Array.isArray(res.data?.demographic_matrix)) {
      throw new Error(`Demographics endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    const genZ = res.data.demographic_matrix.find((d: any) => d.age_group === "18-24");
    const pro = res.data.demographic_matrix.find((d: any) => d.age_group === "25-32");
    return `Gen-Z Top Feature: ${genZ?.top_demanded_amenities[0]?.amenity} | Young Pros Top Feature: ${pro?.top_demanded_amenities[0]?.amenity}`;
  });

  // 39. Ad Performance & Monetization (GET /api/v1/admin/ads/performance)
  await runTest("Ad Performance & Monetization (GET /api/v1/admin/ads/performance)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/ads/performance`);
    if (res.status !== 200 || !res.data?.summary) {
      throw new Error(`Ad performance endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    return `Impressions: ${res.data.summary.total_impressions.toLocaleString()}, Clicks: ${res.data.summary.total_clicks}, CTR: ${res.data.summary.click_through_rate_pct}%, Est Earnings: ₹${res.data.summary.estimated_earnings_inr}`;
  });

  // 40. Platform Growth & Revenue Goals (GET /api/v1/admin/goals)
  await runTest("Platform Growth & Revenue Goals (GET /api/v1/admin/goals)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/goals`);
    if (res.status !== 200 || !Array.isArray(res.data?.goals)) {
      throw new Error(`Goals endpoint invalid: ${JSON.stringify(res.data)}`);
    }
    const revGoal = res.data.goals[0];
    return `Revenue Goal: ₹${revGoal.current_inr}/₹${revGoal.target_inr} (${revGoal.progress_pct}% - ${revGoal.status})`;
  });

  // 41. Semantic Natural Language Search (POST /api/v1/search/semantic)
  await runTest("Semantic Natural Language Search (POST /api/v1/search/semantic)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/search/semantic`, {
      query: "Quiet top-floor flat near tech park with natural sunlight, power backup, and pet friendly",
      city: "Kolkata",
      budget_max: 20000,
      limit: 5,
    });
    if (res.status !== 200 || !Array.isArray(res.data?.properties) || res.data.properties.length === 0) {
      throw new Error(`Semantic search returned invalid results: ${JSON.stringify(res.data)}`);
    }
    const top = res.data.properties[0];
    return `Found ${res.data.results_count} properties. Top match: "${top.title}" in ${top.locality} (Score: ${top.semantic_similarity_score}, Rent: ₹${top.rent}, Matched: ${top.matched_features.slice(0, 2).join(", ")})`;
  });

  // 42. Verified Regional GIS Boundary Lookup (GET /api/v1/geo/boundary)
  await runTest("Verified Regional GIS Boundary Lookup (GET /api/v1/geo/boundary)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/geo/boundary`, {
      params: { region: "Sector V", city: "Kolkata" },
    });
    if (res.status !== 200 || !res.data?.boundary?.bounding_box) {
      throw new Error(`Boundary lookup returned invalid data: ${JSON.stringify(res.data)}`);
    }
    const b = res.data.boundary;
    return `Verified Region: ${b.region_name} (${b.city}), Centroid: [${b.centroid}], BBox: [${b.bounding_box.join(", ")}], Radius: ${b.boundary_radius_km}km, Source: ${b.source}`;
  });

  // 43. Verified Regional Spatial Boundary Verification (POST /api/v1/geo/verify-boundary)
  await runTest("Verified Regional Spatial Boundary Verification (POST /api/v1/geo/verify-boundary)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/geo/verify-boundary`, {
      region: "Bellandur",
      city: "Bangalore",
      coordinates: [77.6750, 12.9300], // inside Bellandur
    });
    if (res.status !== 200 || res.data?.isInside !== true) {
      throw new Error(`Boundary verification failed: ${JSON.stringify(res.data)}`);
    }
    return `Verified: Point [77.675, 12.93] is inside ${res.data.region} (${res.data.city}). Centroid Dist: ${res.data.distanceFromCentroidKm}km (Source: ${res.data.source})`;
  });

  // 44. Standardized Locality Resolution & Canonical Name (GET /api/v1/search/resolve-locality)
  await runTest("Standardized Locality Resolution & Canonical Name (GET /api/v1/search/resolve-locality)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/search/resolve-locality`, {
      params: { q: "sec 5", city: "Kolkata" },
    });
    if (res.status !== 200 || !res.data?.location || res.data.location.canonicalName !== "Sector V, Salt Lake") {
      throw new Error(`Locality resolution failed: ${JSON.stringify(res.data)}`);
    }
    const loc = res.data.location;
    return `Resolved '${loc.searchedName}' -> '${loc.canonicalName}', [${loc.longitude}, ${loc.latitude}], City: ${loc.city}, Source: ${loc.source}, Confidence: ${loc.confidence}`;
  });

  // 45. Spelling Variation & Alias Disambiguation (GET /api/v1/geo/resolve)
  await runTest("Spelling Variation & Alias Disambiguation (GET /api/v1/geo/resolve)", async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/geo/resolve`, {
      params: { q: "hinjewadi", city: "Pune" },
    });
    if (res.status !== 200 || !res.data?.location || res.data.location.canonicalName !== "Hinjawadi") {
      throw new Error(`Alias resolution failed: ${JSON.stringify(res.data)}`);
    }
    const loc = res.data.location;
    return `Resolved '${loc.searchedName}' -> '${loc.canonicalName}', [${loc.longitude}, ${loc.latitude}], Radius: ${loc.boundary_radius_km}km, District: ${loc.district}`;
  });

  // 46. Reverse-Geocoding of Coordinates to Real Locality (POST /api/v1/geo/reverse-geocode)
  await runTest("Reverse-Geocoding of Coordinates to Real Locality (POST /api/v1/geo/reverse-geocode)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/geo/reverse-geocode`, {
      coordinates: [88.4335, 22.5762],
    });
    if (res.status !== 200 || !res.data?.success) {
      throw new Error(`Reverse geocode failed: ${JSON.stringify(res.data)}`);
    }
    return `Coordinates [88.4335, 22.5762] mapped to locality: "${res.data.locality}" (City: "${res.data.city}")`;
  });

  // 47. Exact vs Nearby Property Partition & Distance (POST /api/v1/search)
  await runTest("Exact vs Nearby Property Partition & Distance (POST /api/v1/search)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/search`, {
      query: "I need PG in Sector 5 under 15k",
    });
    if (
      res.status !== 200 ||
      !res.data?.verified_location ||
      !Array.isArray(res.data?.exact_matches) ||
      !Array.isArray(res.data?.nearby_matches) ||
      !res.data?.debug_log
    ) {
      throw new Error(`Search response missing required locality partition: ${JSON.stringify(res.data)}`);
    }
    const top = res.data.recommendations[0];
    const topProp = res.data.properties[0];
    return `Verified Locality: "${res.data.verified_location.canonicalName}". Exact Matches: ${res.data.exact_matches_count}, Nearby Matches: ${res.data.nearby_matches_count}. Top Property Locality: "${topProp.actual_locality_name || topProp.locality}" (Dist: ${topProp.distance_to_office_km}km)`;
  });

  // 48. Debug Trace Logging for Every Locality Search (POST /api/v1/search)
  await runTest("Debug Trace Logging for Every Locality Search (POST /api/v1/search)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/search`, {
      query: "PG in Kestopur near bus stand",
    });
    if (!res.data?.debug_log || !Array.isArray(res.data.debug_log.property_trace)) {
      throw new Error(`Debug log trace missing: ${JSON.stringify(res.data)}`);
    }
    const d = res.data.debug_log;
    return `Debug Trace logged: Query="${d.original_query}", Extracted="${d.extracted_locality}", Canonical="${d.canonical_locality}", Provider="${d.geocoding_provider}", Evaluated=${d.properties_evaluated}, Trace Samples=${d.property_trace.length}`;
  });

  // 49. Move-in Cost, Tariff & Cross-Platform Price Comparison (POST /api/v1/properties/cost-breakdown)
  await runTest("Move-in Cost, Tariff & Cross-Platform Price Comparison (POST /api/v1/properties/cost-breakdown)", async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/properties/cost-breakdown`, {
      title: "Tarulia Main Road AC PG with Food & WiFi",
      city: "Kolkata",
      locality: "Tarulia Lane, Kestopur",
      property_type: "PG",
      rent: 5500,
      source_platform: "Housing",
    });
    if (
      res.status !== 200 ||
      !res.data?.cross_platform_comparison ||
      !res.data?.upfront_move_in_cost ||
      !res.data?.monthly_recurring_utilities
    ) {
      throw new Error(`Cost breakdown failed: ${JSON.stringify(res.data)}`);
    }
    const d = res.data;
    const u = d.monthly_recurring_utilities;
    return `Tarulia PG: Rent=Rs ${d.monthly_rent} (${d.cross_platform_comparison.best_platform}), Upfront=Rs ${d.upfront_move_in_cost.total_upfront_cash_required_inr}, Electricity: Submeter=Rs ${u.landlord_submeter_rate_inr_per_kwh}/kWh (Bill=Rs ${u.estimated_monthly_electricity_inr}/mo), Govt=Rs ${u.official_discom_slab_rate_inr_per_kwh}/kWh, Markup=Rs ${u.landlord_submeter_markup_monthly_inr}/mo`;
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
