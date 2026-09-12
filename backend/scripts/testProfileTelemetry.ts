import axios from "axios";

const BASE_URL = process.env.API_URL || "http://localhost:8001";
const ADMIN_KEY = process.env.TELEMETRY_ADMIN_KEY || "";

async function main() {
  if (!ADMIN_KEY) throw new Error("TELEMETRY_ADMIN_KEY is required for telemetry integration tests.");

  let forbidden = false;
  try {
    await axios.get(`${BASE_URL}/api/v1/users/admin/telemetry?days=7`);
  } catch (error: any) {
    forbidden = error.response?.status === 403;
  }
  if (!forbidden) throw new Error("Telemetry endpoint must reject requests without the admin key.");

  const profile = {
    age_group: "25-32",
    gender: "prefer-not-to-say",
    profession: "Software Engineer",
    target_budget: 22000,
    preferred_city: "Kolkata",
    priority_amenities: ["Metro", "Women Safety", "Fast Internet", "Work Cafes"],
  };

  const personalization = await axios.post(`${BASE_URL}/api/v1/users/guest-profile`, profile);
  if (personalization.status !== 200) throw new Error("Guest personalization request failed.");

  const summary = await axios.get(`${BASE_URL}/api/v1/users/admin/telemetry?days=7`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });
  const data = summary.data || {};
  if (summary.status !== 200 || Number(data.total_profiles) < 1) {
    throw new Error(`Expected at least one aggregate telemetry event: ${JSON.stringify(data)}`);
  }
  if (Number(data.age_groups?.["25-32"] || 0) < 1) throw new Error("Age-group aggregate was not recorded.");
  if (Number(data.roles?.tech_professional || 0) < 1) throw new Error("Role aggregate was not recorded.");
  if (Number(data.cities?.kolkata || 0) < 1) throw new Error("City aggregate was not recorded.");
  if (Number(data.budget_bands?.["15k_25k"] || 0) < 1) throw new Error("Budget-band aggregate was not recorded.");
  if (Number(data.priorities?.metro_transit || 0) < 1) throw new Error("Priority aggregate was not recorded.");
  if (data.privacy?.raw_profiles_stored !== false || data.privacy?.identifiers_stored !== false) {
    throw new Error(`Privacy declaration missing or unsafe: ${JSON.stringify(data.privacy)}`);
  }

  const serialized = JSON.stringify(data).toLowerCase();
  if (serialized.includes("email") || serialized.includes("user_id") || serialized.includes("ip_address")) {
    throw new Error("Telemetry response unexpectedly exposes an identifier field.");
  }

  console.log(`✅ Profile telemetry aggregation passed (${data.total_profiles} aggregate profile event(s) in range).`);
}

main().catch((error) => {
  console.error("❌ Profile telemetry integration test failed:", error.message || error);
  process.exit(1);
});
