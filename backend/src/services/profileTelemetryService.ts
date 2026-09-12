import type { Db } from "mongodb";
import type { GuestProfile } from "../models/user.js";

export type ProfileTelemetrySummary = {
  period: { days: number; from: string; to: string };
  total_profiles: number;
  age_groups: Record<string, number>;
  gender_categories: Record<string, number>;
  roles: Record<string, number>;
  cities: Record<string, number>;
  budget_bands: Record<string, number>;
  priorities: Record<string, number>;
  daily: Array<{ date: string; total_profiles: number }>;
  privacy: {
    raw_profiles_stored: false;
    identifiers_stored: false;
    note: string;
  };
};

const COLLECTION = "profile_telemetry_daily";

function genderCategory(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (["female", "woman", "women"].includes(normalized)) return "female";
  if (["male", "man", "men"].includes(normalized)) return "male";
  if (["non-binary", "nonbinary"].includes(normalized)) return "non_binary";
  if (["prefer-not-to-say", "prefer-not-to-answer", "unspecified"].includes(normalized)) return "prefer_not_to_say";
  return "other";
}

function roleCategory(value: string): string {
  const normalized = value.toLowerCase();
  if (/student|intern|trainee/.test(normalized)) return "student_intern";
  if (/software|developer|engineer|tech|\bit\b|data|product/.test(normalized)) return "tech_professional";
  if (/family|parent|homemaker/.test(normalized)) return "family";
  if (/executive|manager|director|founder|leadership/.test(normalized)) return "executive";
  return "other";
}

function cityCategory(value: string): string {
  const normalized = value.toLowerCase();
  if (/kolkata|calcutta/.test(normalized)) return "kolkata";
  if (/bengaluru|bangalore/.test(normalized)) return "bengaluru";
  if (/pune/.test(normalized)) return "pune";
  if (/hyderabad/.test(normalized)) return "hyderabad";
  return "other";
}

function budgetBand(value: number): string {
  if (value < 15_000) return "under_15k";
  if (value < 25_000) return "15k_25k";
  if (value < 40_000) return "25k_40k";
  if (value < 60_000) return "40k_60k";
  return "60k_plus";
}

function priorityCategory(value: string): string {
  const normalized = value.toLowerCase();
  if (/metro|commute|transit/.test(normalized)) return "metro_transit";
  if (/women safety|safety|security/.test(normalized)) return "safety";
  if (/power backup|generator/.test(normalized)) return "power_backup";
  if (/cafe|coffee|work cafe/.test(normalized)) return "work_cafes";
  if (/pet/.test(normalized)) return "pet_friendly";
  if (/internet|wifi|fiber|broadband/.test(normalized)) return "internet";
  if (/food|grocery/.test(normalized)) return "food_access";
  return "other";
}

function addCounter(target: Record<string, number>, source: Record<string, unknown> | undefined) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) target[key] = (target[key] || 0) + numeric;
  }
}

export async function recordProfileTelemetry(db: Db, profile: GuestProfile): Promise<void> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const priorities = [...new Set(profile.priority_amenities.map(priorityCategory))];
  const increments: Record<string, number> = {
    total_profiles: 1,
    [`age_groups.${profile.age_group}`]: 1,
    [`gender_categories.${genderCategory(profile.gender)}`]: 1,
    [`roles.${roleCategory(profile.profession)}`]: 1,
    [`cities.${cityCategory(profile.preferred_city)}`]: 1,
    [`budget_bands.${budgetBand(profile.target_budget)}`]: 1,
  };
  for (const priority of priorities) increments[`priorities.${priority}`] = 1;

  await db.collection(COLLECTION).updateOne(
    { _id: date },
    {
      $setOnInsert: { date, created_at: now.toISOString() },
      $set: { updated_at: now.toISOString() },
      $inc: increments,
    },
    { upsert: true }
  );
}

export async function getProfileTelemetrySummary(db: Db, days = 30): Promise<ProfileTelemetrySummary> {
  const boundedDays = Math.max(1, Math.min(365, Math.floor(days)));
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (boundedDays - 1));
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  const docs = await db.collection(COLLECTION).find({ date: { $gte: fromDate, $lte: toDate } }).sort({ date: 1 }).toArray();
  const summary: ProfileTelemetrySummary = {
    period: { days: boundedDays, from: fromDate, to: toDate },
    total_profiles: 0,
    age_groups: {},
    gender_categories: {},
    roles: {},
    cities: {},
    budget_bands: {},
    priorities: {},
    daily: [],
    privacy: {
      raw_profiles_stored: false,
      identifiers_stored: false,
      note: "Only coarse daily counters are retained. Email, account IDs, IP addresses, and raw profile values are not written to telemetry storage.",
    },
  };

  for (const doc of docs) {
    const total = Number(doc.total_profiles || 0);
    summary.total_profiles += total;
    summary.daily.push({ date: String(doc.date), total_profiles: total });
    addCounter(summary.age_groups, doc.age_groups as Record<string, unknown> | undefined);
    addCounter(summary.gender_categories, doc.gender_categories as Record<string, unknown> | undefined);
    addCounter(summary.roles, doc.roles as Record<string, unknown> | undefined);
    addCounter(summary.cities, doc.cities as Record<string, unknown> | undefined);
    addCounter(summary.budget_bands, doc.budget_bands as Record<string, unknown> | undefined);
    addCounter(summary.priorities, doc.priorities as Record<string, unknown> | undefined);
  }

  return summary;
}
