import axios from "axios";
import crypto from "crypto";
import type { Db } from "mongodb";
import { config } from "../core/config.js";
import { getDatabase } from "../db/mongo.js";
import { MULTI_CITY_LOCALITIES, cityPartition, type CityKey } from "../data/multiCity.js";
import { SourcePlatform } from "../models/common.js";

export type CommunityListing = {
  city: CityKey;
  locality: string;
  locality_id: string;
  rent: number;
  property_type: string;
  bhk?: number;
  furnishing?: string;
  gender_preference?: string;
  no_brokerage: boolean;
  landmark?: string;
  contact_masked?: string;
  normalized_text: string;
  content_hash: string;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

type TelegramMessage = {
  message_id: number;
  date?: number;
  text?: string;
  caption?: string;
  chat?: { id?: number; title?: string; username?: string; type?: string };
  from?: { username?: string; first_name?: string };
};

const CITY_ALIASES: Array<[CityKey, RegExp]> = [
  ["Bengaluru", /\b(bengaluru|bangalore|blr)\b/i],
  ["Hyderabad", /\b(hyderabad|hyd|hitech|hitec|gachibowli|madhapur|kondapur)\b/i],
  ["Pune", /\b(pune|hinjewadi|hinjawadi|wakad|baner|kharadi)\b/i],
  ["Kolkata", /\b(kolkata|calcutta|sector\s*v|salt\s*lake|new\s*town)\b/i],
];

const LOCALITY_ALIASES: Array<{ city: CityKey; name: string; id: string; aliases: string[] }> = [
  ...MULTI_CITY_LOCALITIES.map((item) => ({
    city: item.city as CityKey,
    name: item.name,
    id: item._id,
    aliases: [item.name, item.name.replace(" / ORR", ""), item.slug.replace(/^(blr|pune|hyd)-/, "").replace(/-/g, " ")],
  })),
  { city: "Kolkata", name: "Sector V", id: "loc-sector-v", aliases: ["sector v", "sector 5", "salt lake sector v", "wipro more"] },
  { city: "Kolkata", name: "New Town", id: "loc-new-town", aliases: ["new town", "rajarhat", "action area"] },
  { city: "Kolkata", name: "Lake Town", id: "loc-lake-town", aliases: ["lake town"] },
];

const CITY_CENTROIDS: Record<CityKey, [number, number]> = {
  Kolkata: [88.4335, 22.5762],
  Bengaluru: [77.5946, 12.9716],
  Pune: [73.8567, 18.5204],
  Hyderabad: [78.4867, 17.385],
};

function canonicalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^a-zA-Z0-9₹@+.,/\-\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseRent(text: string): number | null {
  const patterns = [
    /(?:rent\s*[:=-]?\s*)?(?:₹|rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6}|[0-9]{1,3}(?:\.\d+)?)\s*(k)?(?:\s*\/\s*month|\s*pm|\s*per\s*month)?/gi,
  ];
  const candidates: number[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = Number(match[1].replace(/,/g, ""));
      const value = match[2] ? raw * 1000 : raw;
      if (value >= 3000 && value <= 500000) candidates.push(Math.round(value));
    }
  }
  return candidates.length ? candidates[0] : null;
}

function detectProperty(text: string): { property_type: string; bhk?: number } | null {
  const privateRoom = /\b(private\s*room|master\s*bed(?:room)?|single\s*room)\b/i.test(text);
  const bhk = text.match(/\b([1-6])\s*bhk\b/i);
  const rk = /\b1\s*rk\b/i.test(text);
  if (/\b(pg|paying\s*guest)\b/i.test(text)) return { property_type: "PG" };
  if (privateRoom) return { property_type: "shared flat", bhk: bhk ? Number(bhk[1]) : undefined };
  if (rk) return { property_type: "studio", bhk: 1 };
  if (bhk) return { property_type: "apartment", bhk: Number(bhk[1]) };
  if (/\b(flat|apartment|room)\b/i.test(text)) return { property_type: "apartment" };
  return null;
}

function detectCity(text: string, chatTitle = ""): CityKey | null {
  const combined = `${chatTitle} ${text}`;
  for (const [city, pattern] of CITY_ALIASES) if (pattern.test(combined)) return city;
  return null;
}

function detectLocality(text: string, city: CityKey) {
  const lowered = text.toLowerCase();
  const matches = LOCALITY_ALIASES.filter((entry) => entry.city === city)
    .map((entry) => ({ entry, score: Math.max(...entry.aliases.map((alias) => lowered.includes(alias.toLowerCase()) ? alias.length : 0)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return matches[0]?.entry ?? null;
}

function detectFurnishing(text: string) {
  if (/\bfully\s*furnished\b/i.test(text)) return "fully furnished";
  if (/\bsemi[-\s]*furnished\b/i.test(text)) return "semi-furnished";
  if (/\bunfurnished\b/i.test(text)) return "unfurnished";
  return undefined;
}

function detectGender(text: string) {
  if (/\b(female|girls?|women)\s*(only|preferred|preference)?\b/i.test(text)) return "female";
  if (/\b(male|boys?|men)\s*(only|preferred|preference)?\b/i.test(text)) return "male";
  if (/\b(any\s*gender|male\s*\/\s*female|all\s*welcome)\b/i.test(text)) return "any";
  return undefined;
}

function detectLandmark(text: string) {
  const match = text.match(/\b(?:near|opp\.?|opposite|beside|close\s+to)\s+([^,;\n]{3,55})/i);
  return match?.[1]?.trim();
}

function maskContact(text: string) {
  const username = text.match(/@([a-zA-Z0-9_]{4,32})/);
  if (username) return `@${username[1].slice(0, 2)}***`;
  const phone = text.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
  if (phone) return `******${phone[1].slice(-4)}`;
  return undefined;
}

function looksLikeSpamOrWanted(text: string) {
  const wanted = /\b(looking\s+for|need\s+(?:a\s+)?flat|wanted|searching\s+for|require(?:d)?\s+(?:a\s+)?room)\b/i;
  const services = /\b(packers?|movers?|loan|insurance|maid\s+service|brokerage\s+service|interior\s+design|cleaning\s+service|course|job\s+opening)\b/i;
  return wanted.test(text) || services.test(text);
}

export function parseCommunityListing(text: string, chatTitle = ""): CommunityListing | null {
  if (!text || looksLikeSpamOrWanted(text)) return null;
  const normalized = canonicalize(text);
  const rent = parseRent(normalized);
  const property = detectProperty(normalized);
  const city = detectCity(normalized, chatTitle);
  if (!rent || !property || !city) return null;
  const locality = detectLocality(normalized, city);
  if (!locality) return null;
  const content_hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return {
    city,
    locality: locality.name,
    locality_id: locality.id,
    rent,
    property_type: property.property_type,
    bhk: property.bhk,
    furnishing: detectFurnishing(normalized),
    gender_preference: detectGender(normalized),
    no_brokerage: /\b(no\s*brokerage|zero\s*brokerage|owner\s*direct|direct\s*owner)\b/i.test(normalized),
    landmark: detectLandmark(normalized),
    contact_masked: maskContact(text),
    normalized_text: normalized,
    content_hash,
  };
}

async function resolveLocation(db: Db, listing: CommunityListing): Promise<[number, number]> {
  const locality = await db.collection("localities").findOne({ $or: [{ _id: listing.locality_id as any }, { city: listing.city, name: listing.locality }] } as any);
  const coordinates = locality?.location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) return [Number(coordinates[0]), Number(coordinates[1])];

  const cacheKey = `nominatim:${listing.city.toLowerCase()}:${listing.locality.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const cached = await db.collection("geocode_cache").findOne({ _id: cacheKey as any });
  if (Array.isArray(cached?.coordinates)) return [Number(cached.coordinates[0]), Number(cached.coordinates[1])];

  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${listing.locality}, ${listing.city}, India`, format: "jsonv2", limit: 1, countrycodes: "in" },
      headers: { "User-Agent": config.SCRAPER_USER_AGENT },
      timeout: 8000,
    });
    if (Array.isArray(response.data) && response.data[0]) {
      const resolved: [number, number] = [Number(response.data[0].lon), Number(response.data[0].lat)];
      await db.collection("geocode_cache").updateOne({ _id: cacheKey as any }, { $set: { city: listing.city, locality: listing.locality, coordinates: resolved, quality: "nominatim-community", updated_at: new Date().toISOString() } }, { upsert: true });
      return resolved;
    }
  } catch {
    // Community ingestion must stay available even when Nominatim is unavailable.
  }
  return CITY_CENTROIDS[listing.city];
}

async function ensureCommunityIndexes(db: Db, partition: string) {
  await Promise.all([
    db.collection("community_ingest_events").createIndex({ content_hash: 1, seen_at: -1 }),
    db.collection(partition).createIndex({ dedupe_key: 1 }, { unique: true }),
    db.collection(partition).createIndex({ source_platform: 1, locality_id: 1, rent: 1, last_seen_at: -1 }),
  ]).catch(() => undefined);
}

export async function ingestTelegramUpdate(update: TelegramUpdate) {
  const message = update.channel_post ?? update.message ?? update.edited_channel_post ?? update.edited_message;
  const text = message?.text ?? message?.caption ?? "";
  if (!message || !text) return { accepted: false, reason: "no_text_message" } as const;

  const listing = parseCommunityListing(text, message.chat?.title ?? "");
  if (!listing) return { accepted: false, reason: "not_a_supported_listing" } as const;

  const db = getDatabase();
  const partition = cityPartition(listing.city);
  await ensureCommunityIndexes(db, partition);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const hashDuplicate = await db.collection("community_ingest_events").findOne({ content_hash: listing.content_hash, seen_at: { $gte: sevenDaysAgo } });
  if (hashDuplicate) return { accepted: true, duplicate: true, reason: "content_hash" } as const;

  const similar = await db.collection(partition).findOne({
    source_platform: SourcePlatform.Telegram,
    locality_id: listing.locality_id,
    rent: { $gte: Math.floor(listing.rent * 0.96), $lte: Math.ceil(listing.rent * 1.04) },
    last_seen_at: { $gte: sevenDaysAgo },
    ...(listing.contact_masked ? { contact_masked: listing.contact_masked } : {}),
  });
  if (similar) {
    await db.collection(partition).updateOne({ _id: similar._id }, { $set: { last_seen_at: new Date().toISOString() } });
    await db.collection("community_ingest_events").insertOne({ content_hash: listing.content_hash, seen_at: new Date().toISOString(), duplicate_of: String(similar._id), source: "Telegram" });
    return { accepted: true, duplicate: true, reason: "similar_recent_listing", property_id: String(similar._id) } as const;
  }

  const coordinates = await resolveLocation(db, listing);
  const now = new Date().toISOString();
  const sourceUrl = message.chat?.username ? `https://t.me/${message.chat.username}/${message.message_id}` : undefined;
  const titleParts = [listing.bhk ? `${listing.bhk}BHK` : listing.property_type, listing.property_type === "shared flat" ? "room" : "home", `in ${listing.locality}`];
  const payload = {
    title: titleParts.join(" "),
    source_platform: SourcePlatform.Telegram,
    source_url: sourceUrl,
    property_type: listing.property_type,
    rent: listing.rent,
    deposit: null,
    area_sqft: null,
    furnishing: listing.furnishing ?? null,
    images: [],
    amenities: ["peer-to-peer", ...(listing.no_brokerage ? ["no brokerage"] : []), ...(listing.gender_preference ? [`${listing.gender_preference} preferred`] : [])],
    location: { type: "Point", coordinates },
    locality_id: listing.locality_id,
    nearby_metro: null,
    commute_estimate_minutes: null,
    dedupe_key: `telegram:${listing.content_hash}`,
    price_history: [{ source: SourcePlatform.Telegram, rent: listing.rent, url: sourceUrl, observed_at: now }],
    created_at: now,
    updated_at: now,
    city: listing.city,
    locality: listing.locality,
    landmark: listing.landmark ?? null,
    contact_masked: listing.contact_masked ?? null,
    gender_preference: listing.gender_preference ?? null,
    is_peer_to_peer: true,
    first_seen_at: now,
    last_seen_at: now,
    content_hash: listing.content_hash,
    telegram_chat_id: message.chat?.id ?? null,
    telegram_message_id: message.message_id,
    ingestion_method: "telegram-bot-webhook",
    is_active: true,
  };

  const cityResult = await db.collection(partition).updateOne({ dedupe_key: payload.dedupe_key }, { $set: payload }, { upsert: true });
  const defaultResult = await db.collection("properties").updateOne({ dedupe_key: payload.dedupe_key }, { $set: payload }, { upsert: true });
  await db.collection("community_ingest_events").insertOne({ content_hash: listing.content_hash, seen_at: now, source: "Telegram", city: listing.city, locality_id: listing.locality_id, message_id: message.message_id });

  return {
    accepted: true,
    duplicate: false,
    city: listing.city,
    locality: listing.locality,
    partition,
    property_id: String(cityResult.upsertedId ?? defaultResult.upsertedId ?? payload.dedupe_key),
  } as const;
}
