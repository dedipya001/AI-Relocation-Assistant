import assert from "assert";
import { RecommendationEngine, SCORING_PROFILE_PRESETS } from "../src/services/recommendations.js";

// Sample test fixtures for benchmarking
const LOCALITIES_FIXTURE = {
  "loc-sector-v": {
    _id: "loc-sector-v",
    name: "Sector V",
    scores: {
      overall: 78,
      women_safety: 72,
      late_night: 68,
      internet: 86,
      food_access: 92,
      commute_reliability: 80,
    },
    tags: ["tech workers", "fast internet", "metro connectivity"],
    essentials: [{ name: "Market", category: "grocery", distance_meters: 800 }],
  },
  "loc-new-town": {
    _id: "loc-new-town",
    name: "New Town",
    scores: {
      overall: 84,
      women_safety: 80,
      late_night: 76,
      internet: 82,
      food_access: 78,
      commute_reliability: 72,
    },
    tags: ["planned", "parks", "peaceful"],
    essentials: [{ name: "Mall", category: "mall", distance_meters: 1200 }],
  },
  "loc-outskirts": {
    _id: "loc-outskirts",
    name: "Outskirts Suburb",
    scores: {
      overall: 60,
      women_safety: 55,
      late_night: 50,
      internet: 60,
      food_access: 55,
      commute_reliability: 50,
    },
    tags: ["budget", "isolated"],
    essentials: [],
  },
};

const PROPERTIES_FIXTURE = [
  {
    _id: "prop-cheap-pg",
    title: "Affordable PG near Sector V",
    rent: 7500,
    commute_estimate_minutes: 15,
    locality_id: "loc-sector-v",
    property_type: "PG",
    amenities: ["wifi", "meals"],
    furnishing: "furnished",
    area_sqft: 140,
    location: { type: "Point", coordinates: [88.434, 22.576] },
  },
  {
    _id: "prop-tech-studio",
    title: "High-Tech Studio near Metro",
    rent: 14000,
    commute_estimate_minutes: 8,
    locality_id: "loc-sector-v",
    property_type: "studio",
    amenities: ["fiber internet", "metro connectivity", "power backup"],
    furnishing: "furnished",
    area_sqft: 350,
    location: { type: "Point", coordinates: [88.435, 22.578] },
    price_history: [{ source: "MagicBricks", rent: 14500 }],
  },
  {
    _id: "prop-family-apartment",
    title: "Gated Family 2BHK in New Town",
    rent: 18000,
    commute_estimate_minutes: 32,
    locality_id: "loc-new-town",
    property_type: "apartment",
    amenities: ["lift", "security", "parks", "peaceful", "power backup"],
    furnishing: "semi-furnished",
    area_sqft: 850,
    location: { type: "Point", coordinates: [88.48, 22.58] },
    price_history: [{ source: "99acres", rent: 18000 }, { source: "Housing", rent: 19000 }],
  },
  {
    _id: "prop-far-budget",
    title: "Ultra Budget Flat in Outskirts",
    rent: 5000,
    commute_estimate_minutes: 65,
    locality_id: "loc-outskirts",
    property_type: "apartment",
    amenities: ["unfurnished"],
    furnishing: "unfurnished",
    area_sqft: 400,
    location: { type: "Point", coordinates: [88.35, 22.45] },
  },
];

console.log("=================================================");
console.log("🧪 Deterministic Scoring Engine Benchmark Tests");
console.log("=================================================\n");

const engine = new RecommendationEngine();

// Benchmark 1: Weight Normalization
console.log("▶ Test 1: Weight normalization");
const unnormalized = {
  affordability: 2.0,
  commute: 2.0,
  safety: 1.0,
  internet: 0,
  food_access: 0,
  lifestyle_fit: 0,
  property_quality: 0,
};
const normalized = engine.normalizeWeights(unnormalized);
const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
assert(Math.abs(sum - 1.0) < 0.001, "Normalized weights must sum to 1.0");
assert(normalized.affordability === 0.4, "affordability weight should be 0.4");
assert(normalized.commute === 0.4, "commute weight should be 0.4");
assert(normalized.safety === 0.2, "safety weight should be 0.2");
console.log("  ✅ Weight normalization passed.\n");

// Benchmark 2: Budget Saver Profile
console.log("▶ Test 2: Budget Saver profile behavior");
const budgetSaverRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  [],
  15000,
  { profile: "budget_saver" }
);
assert.strictEqual(budgetSaverRankings.length, 4, "Must rank all 4 properties");
assert(
  budgetSaverRankings[0].entity_id === "prop-cheap-pg" || budgetSaverRankings[0].entity_id === "prop-tech-studio",
  "Top ranked should be an affordable property under budget saver"
);
assert(
  budgetSaverRankings[0].score.subscores?.affordability.weight === SCORING_PROFILE_PRESETS.budget_saver.affordability,
  "Subscore must reflect budget_saver weight"
);
console.log(`  Rank #1: ${budgetSaverRankings[0].title} (Score: ${budgetSaverRankings[0].score.total})`);
console.log(`  Rank #2: ${budgetSaverRankings[1].title} (Score: ${budgetSaverRankings[1].score.total})`);
console.log("  ✅ Budget Saver benchmark passed.\n");

// Benchmark 3: Tech Professional Profile
console.log("▶ Test 3: Tech Professional profile behavior");
const techRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  ["fiber internet", "metro connectivity"],
  20000,
  { profile: "tech_professional" }
);
assert.strictEqual(
  techRankings[0].entity_id,
  "prop-tech-studio",
  "Tech studio with 8-min commute and fiber internet must rank #1 for tech_professional"
);
assert(techRankings[0].score.subscores?.commute.score === 100, "8-min commute must score 100 on commute");
assert(techRankings[0].score.subscores?.internet.score >= 90, "Internet subscore must receive fiber bonus");
console.log(`  Rank #1: ${techRankings[0].title} (Score: ${techRankings[0].score.total})`);
console.log("  ✅ Tech Professional benchmark passed.\n");

// Benchmark 4: Safety Priority Profile
console.log("▶ Test 4: Safety Priority profile behavior");
const safetyRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  ["peaceful"],
  25000,
  { profile: "safety_priority" }
);
const familyNewTown = safetyRankings.find((r) => r.entity_id === "prop-family-apartment");
assert(familyNewTown !== undefined, "New town property must be present");
assert(familyNewTown && familyNewTown.score.subscores && familyNewTown.score.subscores.safety.score >= 80, "New Town safety score must be >= 80");
console.log(`  ${familyNewTown.title} Safety Score: ${familyNewTown.score.subscores?.safety.score}/100`);
console.log("  ✅ Safety Priority benchmark passed.\n");

// Benchmark 5: Hard Constraints (Max Budget Ceiling)
console.log("▶ Test 5: Hard Constraint - Max Budget enforcement");
const hardBudgetRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  [],
  10000,
  {
    profile: "balanced",
    hardConstraints: { max_budget: 10000 },
  }
);
const expensiveProp = hardBudgetRankings.find((r) => r.entity_id === "prop-family-apartment");
assert.strictEqual(expensiveProp?.is_eligible, false, "Property exceeding max_budget must be marked is_eligible=false");
assert(
  expensiveProp?.constraint_violations.some((v) => v.includes("exceeds hard maximum budget")),
  "Must include budget violation detail"
);
assert(
  hardBudgetRankings[0].is_eligible === true,
  "First ranked property must be eligible"
);
console.log(`  Violations for Rs 18,000 apartment: ${expensiveProp?.constraint_violations.join("; ")}`);
console.log("  ✅ Hard Constraint (Max Budget) passed.\n");

// Benchmark 6: Hard Constraints (Max Commute Ceiling)
console.log("▶ Test 6: Hard Constraint - Max Commute enforcement");
const hardCommuteRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  [],
  30000,
  {
    profile: "balanced",
    hardConstraints: { max_commute_minutes: 30 },
  }
);
const farProp = hardCommuteRankings.find((r) => r.entity_id === "prop-far-budget");
assert.strictEqual(farProp?.is_eligible, false, "65-min commute property must be marked is_eligible=false when limit is 30");
console.log(`  Violations for 65-min commute: ${farProp?.constraint_violations.join("; ")}`);
console.log("  ✅ Hard Constraint (Max Commute) passed.\n");

// Benchmark 7: Mandatory Amenities Constraint
console.log("▶ Test 7: Hard Constraint - Mandatory Must-Have Amenities");
const hardAmenityRankings = engine.rank(
  PROPERTIES_FIXTURE,
  LOCALITIES_FIXTURE,
  [],
  30000,
  {
    profile: "balanced",
    hardConstraints: { must_have_amenities: ["lift"] },
  }
);
const liftProp = hardAmenityRankings.find((r) => r.entity_id === "prop-family-apartment");
const noLiftProp = hardAmenityRankings.find((r) => r.entity_id === "prop-cheap-pg");
assert.strictEqual(liftProp?.is_eligible, true, "Property with lift must be eligible");
assert.strictEqual(noLiftProp?.is_eligible, false, "Property without lift must be ineligible");
console.log("  ✅ Mandatory Amenities constraint passed.\n");

// Benchmark 8: Granular Subscores Completeness
console.log("▶ Test 8: Subscores and explainability integrity");
const sampleRec = techRankings[0];
assert(sampleRec.score.subscores !== undefined, "Must contain subscores dictionary");
const expectedSubkeys = ["affordability", "commute", "safety", "internet", "food_access", "lifestyle_fit", "property_quality"];
for (const key of expectedSubkeys) {
  assert(key in sampleRec.score.subscores!, `Subscore key '${key}' must exist`);
  const sub = sampleRec.score.subscores![key];
  assert(sub.score >= 0 && sub.score <= 100, `Subscore ${key} must be between 0 and 100`);
  assert(sub.weight >= 0 && sub.weight <= 1, `Weight ${key} must be between 0 and 1`);
  assert(sub.contribution >= 0 && sub.contribution <= 100, `Contribution ${key} must be valid`);
  assert(typeof sub.details === "string" && sub.details.length > 0, `Details for ${key} must be descriptive`);
}
assert(sampleRec.highlights.length > 0, "Must have positive highlights");
assert(typeof sampleRec.score.explanation === "string" && sampleRec.score.explanation.length > 0, "Must have narrative explanation");
assert(sampleRec.score.confidence_score >= 40 && sampleRec.score.confidence_score <= 100, "Confidence score must be valid");
console.log("  Sample explanation:", sampleRec.score.explanation);
console.log("  Sample highlights:", sampleRec.highlights);
console.log("  ✅ Subscores & explainability integrity passed.\n");

console.log("=================================================");
console.log("✨ ALL 8 DETERMINISTIC BENCHMARKS PASSED! ✨");
console.log("=================================================");
