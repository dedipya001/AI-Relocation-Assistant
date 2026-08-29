import axios from "axios";
import { Command } from "commander";
import crypto from "crypto";
import fs from "fs";
import { Collection, Db, MongoClient } from "mongodb";
import path from "path";
import { config } from "../src/core/config.js";
import { SourcePlatform } from "../src/models/common.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface ImportStats {
  files_processed: number;
  records_seen: number;
  records_normalized: number;
  records_skipped: number;
  records_upserted_city: number;
  records_upserted_default: number;
  stale_marked: number;
  geocode_cache_hits: number;
  geocode_api_calls: number;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function cityCollectionName(city: string): string {
  return `properties_${slugify(city).replace(/-/g, "_")}`;
}

function stableLocalityId(city: string, locality: string): string {
  const place = `${city} ${locality}`.trim();
  const slug = slugify(place);
  const digest = crypto.createHash("sha1").update(place).digest("hex").slice(0, 6);
  return `listing-${slug}-${digest}`;
}

function fallbackCityCoordinates(city: string): [number, number] {
  const text = city.toLowerCase();
  if (text.includes("kolkata")) return [88.4335, 22.5762];
  if (text.includes("bangalore") || text.includes("bengaluru")) return [77.5946, 12.9716];
  if (text.includes("mumbai")) return [72.8777, 19.076];
  if (text.includes("delhi") || text.includes("gurgaon") || text.includes("gurugram")) return [77.1025, 28.7041];
  if (text.includes("pune")) return [73.8567, 18.5204];
  if (text.includes("hyderabad")) return [78.4867, 17.385];
  if (text.includes("chennai")) return [80.2707, 13.0827];
  if (text.includes("ahmedabad")) return [72.5714, 23.0225];
  return [77.209, 28.6139];
}

function parseIntSafe(value: any): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") return Math.floor(value);
  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return null;
    return parseInt(digits, 10);
  }
  return null;
}

function normalizePropertyType(value: any, title: string): string {
  const text = `${value || ""} ${title}`.toLowerCase();
  if (text.includes("pg") || text.includes("paying guest")) return "PG";
  if (text.includes("hostel")) return "hostel";
  if (text.includes("studio") || text.includes("1rk")) return "studio";
  if (text.includes("room") || text.includes("shared")) return "shared flat";
  return "apartment";
}

function buildDedupeKey(title: string, rent: number, localityId: string, sourceUrl?: string | null): string {
  const stable = `${SourcePlatform.MagicBricks}:${title}:${rent}:${localityId}:${sourceUrl || ""}`;
  return crypto.createHash("sha1").update(stable).digest("hex");
}

class LocalityGeocoder {
  private collection: Collection;
  private dryRun: boolean;
  private memoryCache: Map<string, [number, number]> = new Map();
  private lastCallTs = 0;

  constructor(db: Db, dryRun: boolean) {
    this.collection = db.collection("geocode_cache");
    this.dryRun = dryRun;
  }

  async resolve(city: string, locality: string, stats: ImportStats): Promise<[number, number, string]> {
    const key = `nominatim:${slugify(city)}:${slugify(locality)}`;
    if (this.memoryCache.has(key)) {
      stats.geocode_cache_hits++;
      const [lon, lat] = this.memoryCache.get(key)!;
      return [lon, lat, "cache-memory"];
    }

    const cached = await this.collection.findOne({ _id: key as any });
    if (cached && Array.isArray((cached as any).coordinates)) {
      const coords = (cached as any).coordinates as [number, number];
      this.memoryCache.set(key, [coords[0], coords[1]]);
      stats.geocode_cache_hits++;
      return [coords[0], coords[1], "cache-db"];
    }

    const query = locality ? `${locality}, ${city}, India` : `${city}, India`;
    let coords = await this.queryNominatim(query, stats);
    let quality = "nominatim-locality";

    if (!coords) {
      coords = await this.queryNominatim(`${city}, India`, stats);
      quality = "nominatim-city";
    }

    if (!coords) {
      coords = fallbackCityCoordinates(city);
      quality = "fallback-city-centroid";
    }

    if (!this.dryRun) {
      await this.collection.updateOne(
        { _id: key as any },
        {
          $set: {
            city,
            locality,
            coordinates: [coords[0], coords[1]],
            quality,
            updated_at: new Date().toISOString(),
          },
          $setOnInsert: { created_at: new Date().toISOString() },
        },
        { upsert: true }
      );
    }

    this.memoryCache.set(key, coords);
    return [coords[0], coords[1], quality];
  }

  private async queryNominatim(query: string, stats: ImportStats): Promise<[number, number] | null> {
    const now = Date.now();
    const elapsed = (now - this.lastCallTs) / 1000;
    if (elapsed < 1.0) {
      await new Promise((resolve) => setTimeout(resolve, (1.0 - elapsed) * 1000));
    }

    try {
      const response = await axios.get(NOMINATIM_URL, {
        params: {
          q: query,
          format: "jsonv2",
          limit: 1,
          countrycodes: "in",
        },
        headers: { "User-Agent": config.SCRAPER_USER_AGENT },
        timeout: 20000,
      });
      this.lastCallTs = Date.now();
      stats.geocode_api_calls++;

      const rows = response.data;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      return [parseFloat(rows[0].lon), parseFloat(rows[0].lat)];
    } catch {
      this.lastCallTs = Date.now();
      return null;
    }
  }
}

async function ensureIndexes(collection: Collection) {
  try {
    await collection.createIndex({ location: "2dsphere" });
    await collection.createIndex({ dedupe_key: 1 }, { unique: true });
    await collection.createIndex({ locality_id: 1, rent: 1 });
    await collection.createIndex({ source_platform: 1, is_active: 1 });
  } catch {
    // Indexes might already exist
  }
}

function normalizeListing(
  raw: Record<string, any>,
  options: { city: string; locality: string; lon: number; lat: number; runId: string }
): Record<string, any> | null {
  const { city, locality, lon, lat, runId } = options;
  const title = (raw.title || "").trim();
  const rent = parseIntSafe(raw.rent ?? raw.price_inr ?? raw.price);

  if (!title || !rent || rent <= 0) return null;

  const localityId = stableLocalityId(city, locality);
  const sourceUrl = raw.source_url || raw.url || null;
  const dedupeKey = buildDedupeKey(title, rent, localityId, sourceUrl);
  const now = new Date().toISOString();

  const furnishing = raw.furnishing || null;
  let amenities: string[] = [];
  if (Array.isArray(raw.amenities) && raw.amenities.length > 0) {
    amenities = [...raw.amenities];
  } else {
    amenities = [SourcePlatform.MagicBricks, "dataset-imported"];
    if (typeof furnishing === "string" && furnishing.trim()) {
      amenities.push(furnishing.trim());
    }
    const bhk = parseIntSafe(raw.bhk);
    if (bhk) {
      amenities.push(`${bhk}bhk`);
    }
  }

  const images = Array.isArray(raw.images) ? raw.images : [];
  const coords: [number, number] =
    Array.isArray(raw.location?.coordinates) && raw.location.coordinates.length >= 2
      ? [parseFloat(raw.location.coordinates[0]), parseFloat(raw.location.coordinates[1])]
      : [lon, lat];

  return {
    title,
    source_platform: raw.source_platform || SourcePlatform.MagicBricks,
    source_url: sourceUrl,
    property_type: normalizePropertyType(raw.property_type || raw.propertyType, title),
    rent,
    deposit: parseIntSafe(raw.deposit) ?? rent * 2,
    area_sqft: parseIntSafe(raw.area_sqft ?? raw.carpet_area_sqft),
    furnishing,
    images,
    amenities,
    location: { type: "Point", coordinates: coords },
    locality_id: localityId,
    nearby_metro: raw.nearby_metro || null,
    commute_estimate_minutes: parseIntSafe(raw.commute_estimate_minutes) ?? null,
    dedupe_key: dedupeKey,
    price_history: [
      {
        source: raw.source_platform || SourcePlatform.MagicBricks,
        rent,
        url: sourceUrl,
        observed_at: now,
      },
    ],
    created_at: now,
    updated_at: now,
    is_active: true,
    scrape_run_id: runId,
    last_seen_at: now,
    inactive_since: null,
    city,
    locality,
    search_mode: raw.searchMode,
    project_name: raw.project_name,
    developer: raw.developer,
    rera_id: raw.rera_id,
    ingestion_method: "dataset-json-import",
  };
}

async function run() {
  const program = new Command();
  program
    .description("Import MagicBricks datasetJson files into city-wise MongoDB collections.")
    .option("--dataset-dir <path>", "Directory containing dataset JSON files", path.resolve(process.cwd(), "../datasetJson"))
    .option("--city <cities...>", "Limit import to city (repeatable/multiple)", [])
    .option("--mongo-uri <uri>", "MongoDB URI override", config.MONGODB_URI)
    .option("--mongo-db <db>", "MongoDB database name override", config.MONGODB_DB)
    .option("--dry-run", "Parse and normalize only, no database writes", false)
    .option("--no-deactivate-stale", "Skip stale deactivation per city collection", false)
    .option("--also-write-default-properties", "Also upsert into default properties collection for API compatibility", false)
    .option("--max-records <number>", "Limit normalized records for testing", "0");

  program.parse();
  const options = program.opts();

  const datasetDir = path.resolve(options.datasetDir);
  if (!fs.existsSync(datasetDir)) {
    throw new Error(`Dataset directory not found: ${datasetDir}`);
  }

  const cityFilter = new Set<string>((options.city || []).map((c: string) => c.trim().toLowerCase()).filter(Boolean));
  const maxRecords = parseInt(options.maxRecords, 10) || 0;
  const runId = `dataset-magicbricks-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const stats: ImportStats = {
    files_processed: 0,
    records_seen: 0,
    records_normalized: 0,
    records_skipped: 0,
    records_upserted_city: 0,
    records_upserted_default: 0,
    stale_marked: 0,
    geocode_cache_hits: 0,
    geocode_api_calls: 0,
  };

  const client = new MongoClient(options.mongoUri);
  try {
    await client.connect();
    const db = client.db(options.mongoDb);
    const geocoder = new LocalityGeocoder(db, options.dryRun);

    const files = fs
      .readdirSync(datasetDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => path.join(datasetDir, f));

    const seenCityIndexes = new Set<string>();
    const observedKeysByCollection = new Map<string, Set<string>>();

    for (const filePath of files) {
      let rows: any;
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        rows = JSON.parse(content);
      } catch (err) {
        console.warn(`[WARN] Could not parse ${path.basename(filePath)}:`, err);
        continue;
      }

      if (!Array.isArray(rows)) {
        console.warn(`[WARN] Unexpected non-array JSON in ${path.basename(filePath)}, skipping.`);
        continue;
      }

      stats.files_processed++;

      for (const raw of rows) {
        if (!raw || typeof raw !== "object") {
          stats.records_skipped++;
          continue;
        }

        stats.records_seen++;
        const city = (raw.city || "Unknown").trim() || "Unknown";
        const locality = (raw.locality || city).trim() || city;

        if (cityFilter.size > 0 && !cityFilter.has(city.toLowerCase())) {
          continue;
        }

        const cityCollName = cityCollectionName(city);
        if (!seenCityIndexes.has(cityCollName) && !options.dryRun) {
          await ensureIndexes(db.collection(cityCollName));
          seenCityIndexes.add(cityCollName);
        }

        let lon = 0;
        let lat = 0;
        let quality = "dataset-embedded";
        if (Array.isArray(raw.location?.coordinates) && raw.location.coordinates.length >= 2) {
          lon = parseFloat(raw.location.coordinates[0]);
          lat = parseFloat(raw.location.coordinates[1]);
        } else {
          const resolved = await geocoder.resolve(city, locality, stats);
          lon = resolved[0];
          lat = resolved[1];
          quality = resolved[2];
        }

        const payload = normalizeListing(raw, { city, locality, lon, lat, runId });
        if (!payload) {
          stats.records_skipped++;
          continue;
        }

        payload.geo_quality = quality;
        stats.records_normalized++;

        if (!observedKeysByCollection.has(cityCollName)) {
          observedKeysByCollection.set(cityCollName, new Set());
        }
        observedKeysByCollection.get(cityCollName)!.add(payload.dedupe_key);

        if (maxRecords > 0 && stats.records_normalized > maxRecords) {
          break;
        }

        if (options.dryRun) {
          continue;
        }

        const now = new Date().toISOString();
        payload.updated_at = now;
        payload.last_seen_at = now;
        payload.is_active = true;
        payload.inactive_since = null;
        payload.scrape_run_id = runId;

        const { created_at, ...updateFields } = payload;

        await db.collection(cityCollName).updateOne(
          { dedupe_key: payload.dedupe_key },
          {
            $set: updateFields,
            $setOnInsert: { created_at: created_at || now, first_seen_at: now },
          },
          { upsert: true }
        );
        stats.records_upserted_city++;

        if (options.alsoWriteDefaultProperties) {
          await db.collection("properties").updateOne(
            { dedupe_key: payload.dedupe_key },
            {
              $set: updateFields,
              $setOnInsert: { created_at: created_at || now, first_seen_at: now },
            },
            { upsert: true }
          );
          stats.records_upserted_default++;
        }
      }

      if (maxRecords > 0 && stats.records_normalized > maxRecords) {
        break;
      }
    }

    if (!options.dryRun && options.deactivateStale) {
      const now = new Date().toISOString();
      for (const [collName, observed] of observedKeysByCollection.entries()) {
        const result = await db.collection(collName).updateMany(
          {
            source_platform: SourcePlatform.MagicBricks,
            dedupe_key: { $nin: Array.from(observed) },
            is_active: { $ne: false },
          },
          {
            $set: {
              is_active: false,
              inactive_since: now,
              updated_at: now,
              scrape_run_id: runId,
            },
          }
        );
        stats.stale_marked += result.modifiedCount;
      }
    }

    const summary = {
      run_id: runId,
      dataset_dir: datasetDir,
      ...stats,
      dry_run: options.dryRun,
      city_filter: Array.from(cityFilter),
      also_write_default_properties: options.alsoWriteDefaultProperties,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
