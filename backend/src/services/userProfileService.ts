import { randomBytes } from "crypto";
import { ObjectId, type Db } from "mongodb";
import { config } from "../core/config.js";
import type { ScoringProfile, ScoringWeights } from "../models/ai.js";
import {
  GuestProfileSchema,
  type GuestProfile,
  type ShortlistItemInput,
  type ShortlistStatus,
  type StoredShortlistItem,
  type UserDocument,
} from "../models/user.js";
import { RecommendationEngine, SCORING_PROFILE_PRESETS } from "./recommendations.js";

const recommendationEngine = new RecommendationEngine();

export interface GuestPersonalizationResult {
  profile: GuestProfile;
  scoring_profile: ScoringProfile;
  weights: ScoringWeights;
  recommended_filters: {
    city: string;
    budget_max: number;
    priority_amenities: string[];
    scoring_profile: ScoringProfile;
  };
}

function normalizedText(values: string[]): string {
  return values.join(" ").toLowerCase();
}

function chooseProfile(profile: GuestProfile): ScoringProfile {
  const profession = profile.profession.toLowerCase();
  const priorities = normalizedText(profile.priority_amenities);
  if (/student|intern|trainee/.test(profession)) return "budget_saver";
  if (/software|developer|engineer|tech|it\b|data|product/.test(profession)) return "tech_professional";
  if (/family|parent|homemaker/.test(profession)) return "family_first";
  if (/women safety|safety|security/.test(priorities)) return "safety_priority";
  if (/night|late/.test(priorities)) return "night_owl";
  return "balanced";
}

export function computeGuestPersonalization(input: GuestProfile): GuestPersonalizationResult {
  const profile = GuestProfileSchema.parse(input);
  const scoringProfile = chooseProfile(profile);
  const weights: ScoringWeights = { ...SCORING_PROFILE_PRESETS[scoringProfile] };
  const profession = profile.profession.toLowerCase();
  const priorities = normalizedText(profile.priority_amenities);

  if (profile.age_group === "18-24") {
    weights.affordability += 0.08;
    weights.lifestyle_fit += 0.03;
  } else if (profile.age_group === "25-32") {
    weights.commute += 0.05;
    weights.internet += 0.04;
  } else if (profile.age_group === "33-45") {
    weights.safety += 0.06;
    weights.property_quality += 0.04;
  } else {
    weights.safety += 0.08;
    weights.property_quality += 0.06;
  }

  if (/student|intern|trainee/.test(profession)) weights.affordability += 0.10;
  if (/software|developer|engineer|tech|it\b|data|product/.test(profession)) {
    weights.commute += 0.06;
    weights.internet += 0.08;
  }
  if (/executive|manager|director|founder/.test(profession)) {
    weights.commute += 0.06;
    weights.property_quality += 0.05;
  }

  if (/metro|commute|transit/.test(priorities)) weights.commute += 0.09;
  if (/women safety|safety|security/.test(priorities)) weights.safety += 0.10;
  if (/internet|wifi|fiber|broadband/.test(priorities)) weights.internet += 0.09;
  if (/cafe|coffee|food|grocery/.test(priorities)) weights.food_access += 0.07;
  if (/pet|nightlife|social|park/.test(priorities)) weights.lifestyle_fit += 0.08;
  if (/power backup|generator|lift|parking/.test(priorities)) weights.property_quality += 0.07;

  const normalized = recommendationEngine.normalizeWeights(weights);
  return {
    profile,
    scoring_profile: scoringProfile,
    weights: normalized,
    recommended_filters: {
      city: profile.preferred_city,
      budget_max: profile.target_budget,
      priority_amenities: profile.priority_amenities,
      scoring_profile: scoringProfile,
    },
  };
}

export function sanitizeUser(user: Record<string, any>) {
  return {
    id: String(user._id),
    email: String(user.email),
    profile: user.profile || null,
    weight_overrides: user.weight_overrides || null,
    search_history: Array.isArray(user.search_history) ? user.search_history : [],
    shortlists: Array.isArray(user.shortlists) ? user.shortlists : [],
    notification_preferences: user.notification_preferences || {
      price_drops: true,
      new_listings: true,
      product_updates: false,
    },
    share_id: user.share_token || null,
    share_url: user.share_token ? `${config.SITE_URL.replace(/\/$/, "")}/shortlist/${user.share_token}` : null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function findUserById(db: Db, userId: string) {
  if (!ObjectId.isValid(userId)) return null;
  return db.collection("users").findOne({ _id: new ObjectId(userId) });
}

export async function findUserByEmail(db: Db, email: string) {
  return db.collection("users").findOne({ email: email.toLowerCase() });
}

export async function findUserByGoogleSub(db: Db, googleSub: string) {
  return db.collection("users").findOne({ google_sub: googleSub });
}

function shortlistFromGuestIds(propertyIds: string[]): StoredShortlistItem[] {
  const now = new Date().toISOString();
  return [...new Set(propertyIds)].map((propertyId) => ({
    property_id: propertyId,
    notes: "",
    status: "bookmarked",
    added_at: now,
    updated_at: now,
  }));
}

export async function createUser(
  db: Db,
  input: {
    email: string;
    password_hash?: string;
    google_sub?: string;
    guest_profile?: GuestProfile;
    guest_saved_properties?: string[];
  }
) {
  const now = new Date().toISOString();
  const personalization = input.guest_profile ? computeGuestPersonalization(input.guest_profile) : null;
  const user: UserDocument = {
    email: input.email.toLowerCase(),
    password_hash: input.password_hash,
    google_sub: input.google_sub,
    profile: personalization?.profile,
    weight_overrides: personalization?.weights,
    search_history: [],
    shortlists: shortlistFromGuestIds(input.guest_saved_properties || []),
    notification_preferences: {
      price_drops: true,
      new_listings: true,
      product_updates: false,
    },
    created_at: now,
    updated_at: now,
  };
  const result = await db.collection("users").insertOne(user as any);
  return { ...user, _id: result.insertedId };
}

export async function mergeGoogleIdentity(db: Db, userId: ObjectId, googleSub: string) {
  await db.collection("users").updateOne(
    { _id: userId },
    { $set: { google_sub: googleSub, updated_at: new Date().toISOString() } }
  );
}

export async function updateUserProfile(
  db: Db,
  user: Record<string, any>,
  input: {
    profile?: Partial<GuestProfile>;
    weight_overrides?: Partial<ScoringWeights>;
    notification_preferences?: Record<string, boolean | undefined>;
  }
) {
  const set: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.profile) {
    const mergedProfile = { ...(user.profile || {}), ...input.profile };
    set.profile = mergedProfile;
    const complete = GuestProfileSchema.safeParse(mergedProfile);
    if (complete.success && !input.weight_overrides) {
      set.weight_overrides = computeGuestPersonalization(complete.data).weights;
    }
  }
  if (input.weight_overrides) {
    const base = { ...(user.weight_overrides || SCORING_PROFILE_PRESETS.balanced), ...input.weight_overrides } as ScoringWeights;
    set.weight_overrides = recommendationEngine.normalizeWeights(base);
  }
  if (input.notification_preferences) {
    set.notification_preferences = {
      ...(user.notification_preferences || {}),
      ...Object.fromEntries(Object.entries(input.notification_preferences).filter(([, value]) => value !== undefined)),
    };
  }
  await db.collection("users").updateOne({ _id: user._id }, { $set: set });
  return db.collection("users").findOne({ _id: user._id });
}

function propertyIdFilter(propertyId: string): Record<string, any> {
  const options: Record<string, any>[] = [{ _id: propertyId as any }];
  if (ObjectId.isValid(propertyId)) options.push({ _id: new ObjectId(propertyId) });
  return { $or: options };
}

export async function findPropertySnapshot(db: Db, propertyId: string): Promise<Record<string, any> | null> {
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => name === "properties" || name.startsWith("properties_"));

  for (const collectionName of collectionNames) {
    const property = await db.collection(collectionName).findOne(propertyIdFilter(propertyId));
    if (!property) continue;
    return {
      _id: String(property._id),
      title: property.title || null,
      rent: Number.isFinite(Number(property.rent)) ? Number(property.rent) : null,
      locality_id: property.locality_id || null,
      commute_estimate_minutes: Number.isFinite(Number(property.commute_estimate_minutes))
        ? Number(property.commute_estimate_minutes)
        : null,
      source_platform: property.source_platform || null,
      source_url: property.source_url || property.listing_url || null,
      amenities: Array.isArray(property.amenities) ? property.amenities : [],
    };
  }
  return null;
}

export async function upsertShortlistItem(db: Db, user: Record<string, any>, input: ShortlistItemInput) {
  const now = new Date().toISOString();
  const existing: StoredShortlistItem[] = Array.isArray(user.shortlists) ? user.shortlists : [];
  const snapshot = await findPropertySnapshot(db, input.property_id);
  if (!snapshot) throw new Error("Property not found.");

  const next = [...existing];
  const index = next.findIndex((item) => item.property_id === input.property_id);
  if (index >= 0) {
    next[index] = {
      ...next[index],
      notes: input.notes,
      status: input.status,
      property_snapshot: snapshot,
      updated_at: now,
    };
  } else {
    next.push({
      property_id: input.property_id,
      notes: input.notes,
      status: input.status,
      property_snapshot: snapshot,
      added_at: now,
      updated_at: now,
    });
  }

  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { shortlists: next, updated_at: now } }
  );
  return next;
}

export async function updateShortlistItem(
  db: Db,
  user: Record<string, any>,
  propertyId: string,
  patch: { notes?: string; status?: ShortlistStatus }
) {
  const existing: StoredShortlistItem[] = Array.isArray(user.shortlists) ? user.shortlists : [];
  const index = existing.findIndex((item) => item.property_id === propertyId);
  if (index < 0) return null;
  const next = [...existing];
  next[index] = {
    ...next[index],
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    updated_at: new Date().toISOString(),
  };
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { shortlists: next, updated_at: new Date().toISOString() } }
  );
  return next[index];
}

export async function removeShortlistItem(db: Db, user: Record<string, any>, propertyId: string) {
  const existing: StoredShortlistItem[] = Array.isArray(user.shortlists) ? user.shortlists : [];
  const next = existing.filter((item) => item.property_id !== propertyId);
  if (next.length === existing.length) return false;
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { shortlists: next, updated_at: new Date().toISOString() } }
  );
  return true;
}

export async function hydrateShortlist(db: Db, shortlists: StoredShortlistItem[]) {
  const hydrated = [];
  for (const item of shortlists) {
    const snapshot = (await findPropertySnapshot(db, item.property_id)) || item.property_snapshot || null;
    hydrated.push({ ...item, property: snapshot });
  }
  return hydrated;
}

export async function ensureShareToken(db: Db, user: Record<string, any>) {
  if (user.share_token) return String(user.share_token);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = `sh-${randomBytes(12).toString("base64url")}`;
    const exists = await db.collection("users").findOne({ share_token: token }, { projection: { _id: 1 } });
    if (exists) continue;
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { share_token: token, updated_at: new Date().toISOString() } }
    );
    return token;
  }
  throw new Error("Unable to create a unique share link.");
}

export async function getSharedShortlist(db: Db, shareToken: string) {
  const user = await db.collection("users").findOne({ share_token: shareToken });
  if (!user) return null;
  const items = await hydrateShortlist(db, Array.isArray(user.shortlists) ? user.shortlists : []);
  return {
    share_id: shareToken,
    read_only: true,
    items,
    updated_at: user.updated_at,
  };
}
