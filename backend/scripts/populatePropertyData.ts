import { Command } from "commander";
import crypto from "crypto";
import fs from "fs";
import { Db, MongoClient } from "mongodb";
import { chromium, Page, Response } from "playwright";
import { config } from "../src/core/config.js";
import { SourcePlatform } from "../src/models/common.js";

const TITLE_KEYS = ["title", "name", "displayName", "projectName", "headline"];
const RENT_KEYS = ["rent", "price", "monthlyRent", "amount", "minRent", "maxRent"];
const ID_KEYS = ["id", "propertyId", "listingId", "uuid", "inventoryId"];
const LAT_KEYS = ["lat", "latitude", "geoLat"];
const LON_KEYS = ["lng", "lon", "longitude", "geoLng"];

interface CollectedPayload {
  url: string;
  body: any;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "india";
}

function defaultSearchUrls(city: string): string[] {
  const citySlug = slugify(city);
  if (citySlug === "kolkata") {
    return [
      "https://housing.com/rent/flats-for-rent-in-kolkata-west-bengal-P40qcmycif4m431jo",
      "https://housing.com/in/buy/kolkata",
    ];
  }
  return [
    `https://housing.com/in/rent/${citySlug}`,
    `https://housing.com/in/buy/${citySlug}`,
  ];
}

class HousingNetworkCollector {
  private maxPages: number;
  private waitAfterLoadMs: number;
  private scrollSteps: number;
  private storageStatePath?: string;
  public payloads: CollectedPayload[] = [];

  constructor(options: {
    maxPages: number;
    waitAfterLoadMs: number;
    scrollSteps: number;
    storageStatePath?: string;
  }) {
    this.maxPages = options.maxPages;
    this.waitAfterLoadMs = options.waitAfterLoadMs;
    this.scrollSteps = options.scrollSteps;
    this.storageStatePath = options.storageStatePath;
  }

  async collect(urls: string[], headless: boolean, timeoutMs: number): Promise<CollectedPayload[]> {
    const browser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const contextOptions: any = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-IN",
      viewport: { width: 1460, height: 900 },
      timezoneId: "Asia/Kolkata",
      extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
    };

    if (this.storageStatePath && fs.existsSync(this.storageStatePath)) {
      contextOptions.storageState = this.storageStatePath;
    }

    const context = await browser.newContext(contextOptions);
    await context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    `);

    const page = await context.newPage();
    page.on("response", async (response: Response) => {
      await this.captureResponse(response);
    });

    for (const rawUrl of urls) {
      const pageUrls = this.expandPagedUrls(rawUrl);
      for (const pageUrl of pageUrls) {
        console.log(`[INFO] navigate ${pageUrl}`);
        try {
          await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
          await page.waitForTimeout(this.waitAfterLoadMs);
          await this.scrollToTriggerRequests(page);
          try {
            await page.waitForLoadState("networkidle", { timeout: 5000 });
          } catch {
            // timeout ignore
          }
          await this.captureBootstrapPayloads(page, pageUrl);
        } catch (exc) {
          console.warn(`[WARN] navigation failed url=${pageUrl} error=${(exc as Error).message}`);
        }
      }
    }

    await context.close();
    await browser.close();
    return this.payloads;
  }

  private expandPagedUrls(rawUrl: string): string[] {
    if (rawUrl.includes("{page}")) {
      const list: string[] = [];
      for (let i = 1; i <= this.maxPages; i++) {
        list.push(rawUrl.replace("{page}", String(i)));
      }
      return list;
    }
    return [rawUrl];
  }

  private async scrollToTriggerRequests(page: Page): Promise<void> {
    for (let i = 0; i < this.scrollSteps; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(700);
    }
  }

  private async captureResponse(response: Response): Promise<void> {
    const url = response.url();
    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.includes("housing")) return;

    const headers = response.headers();
    const contentType = headers["content-type"] || "";
    const hints = ["/api/", "/graphql", "search", "listing", "property", "results"];
    const shouldAttempt = contentType.toLowerCase().includes("json") || hints.some((h) => lowerUrl.includes(h));

    if (!shouldAttempt) return;

    try {
      const body = await response.json();
      if (body) {
        this.payloads.push({ url, body });
      }
    } catch {
      // Not valid json
    }
  }

  private async captureBootstrapPayloads(page: Page, pageUrl: string): Promise<void> {
    try {
      const snapshots = await page.evaluate(`
        (() => {
          const out = [];
          const keys = ["__NEXT_DATA__", "__INITIAL_STATE__", "__PRELOADED_STATE__"];
          for (const key of keys) {
            if (typeof window[key] !== "undefined") {
              out.push({ key, payload: window[key] });
            }
          }
          const nextDataScript = document.querySelector("script#__NEXT_DATA__");
          if (nextDataScript && nextDataScript.textContent) {
            try {
              out.push({ key: "__NEXT_DATA___SCRIPT", payload: JSON.parse(nextDataScript.textContent) });
            } catch {}
          }
          return out;
        })()
      `);

      if (Array.isArray(snapshots)) {
        for (const snapshot of snapshots) {
          if (snapshot?.payload) {
            this.payloads.push({
              url: `${pageUrl}#${snapshot.key || "window"}`,
              body: snapshot.payload,
            });
          }
        }
      }
    } catch (exc) {
      console.warn(`[WARN] bootstrap_payload_capture_failed url=${pageUrl} error=${(exc as Error).message}`);
    }
  }
}

function extractListingCandidates(node: any): any[] {
  const candidates: any[] = [];
  function walk(item: any) {
    if (!item) return;
    if (typeof item === "object") {
      if (Array.isArray(item)) {
        item.forEach(walk);
      } else {
        if (looksLikeListing(item)) {
          candidates.push(item);
        }
        Object.values(item).forEach(walk);
      }
    }
  }
  walk(node);
  return candidates;
}

function looksLikeListing(item: Record<string, any>): boolean {
  const hasPrice = pickFirstNumber(item, RENT_KEYS) !== null;
  const hasTitleOrId = pickFirstString(item, TITLE_KEYS) !== null || pickFirstString(item, ID_KEYS) !== null;
  const hasCoords = extractCoordinates(item) !== null;
  return hasPrice && hasTitleOrId && hasCoords;
}

function extractCoordinates(item: Record<string, any>): [number, number] | null {
  const lat = pickFirstNumber(item, LAT_KEYS);
  const lon = pickFirstNumber(item, LON_KEYS);
  if (lat !== null && lon !== null) {
    return [lon, lat];
  }
  return null;
}

function pickFirstString(item: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    if (typeof item[k] === "string" && item[k].trim()) {
      return item[k].trim();
    }
  }
  return null;
}

function pickFirstNumber(item: Record<string, any>, keys: string[]): number | null {
  for (const k of keys) {
    const val = item[k];
    if (typeof val === "number" && val > 0) return val;
    if (typeof val === "string") {
      const parsed = parseInt(val.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

class HousingNormalizer {
  private city: string;
  private citySlug: string;
  private runId: string;

  constructor(city: string, runId: string) {
    this.city = city;
    this.citySlug = slugify(city);
    this.runId = runId;
  }

  normalizeMany(payloads: CollectedPayload[], limit?: number): { normalized: Record<string, any>[]; skipped: number } {
    const candidates: Array<{ item: any; url: string }> = [];
    const seenPayload = new Set<string>();

    for (const payload of payloads) {
      const fingerprint = crypto.createHash("sha1").update(`${payload.url}:${JSON.stringify(payload.body)}`).digest("hex");
      if (seenPayload.has(fingerprint)) continue;
      seenPayload.add(fingerprint);
      candidates.push(...extractListingCandidates(payload.body).map((item) => ({ item, url: payload.url })));
    }

    const deduped = new Map<string, Record<string, any>>();
    let skipped = 0;

    for (const { item, url } of candidates) {
      const normalized = this.normalizeListing(item, url);
      if (!normalized) {
        skipped++;
        continue;
      }
      deduped.set(normalized.dedupe_key, normalized);
      if (limit && deduped.size >= limit) {
        break;
      }
    }

    return { normalized: Array.from(deduped.values()), skipped };
  }

  private normalizeListing(rawItem: Record<string, any>, sourceUrl: string): Record<string, any> | null {
    const title = pickFirstString(rawItem, TITLE_KEYS) || "Housing listing";
    const propertyId = pickFirstString(rawItem, ID_KEYS);
    const rentValue = pickFirstNumber(rawItem, RENT_KEYS);
    if (!rentValue || rentValue <= 0) return null;

    const coords = extractCoordinates(rawItem);
    if (!coords) return null;
    const [lon, lat] = coords;

    const propertyType = this.inferPropertyType(rawItem, title);
    const listingUrl = this.extractListingUrl(rawItem) || sourceUrl;
    const now = new Date().toISOString();
    const stableIdentity = propertyId || `${title}:${lon.toFixed(5)}:${lat.toFixed(5)}:${rentValue}:${listingUrl}`;
    const dedupeKey = crypto.createHash("sha1").update(stableIdentity).digest("hex");

    return {
      title,
      source_platform: SourcePlatform.Housing,
      source_url: listingUrl,
      property_type: propertyType,
      rent: rentValue,
      deposit: rentValue,
      area_sqft: pickFirstNumber(rawItem, ["area", "areaSqft", "builtUpArea", "carpetArea"]),
      furnishing: pickFirstString(rawItem, ["furnishing", "furnishingStatus", "furnishedType"]),
      images: [],
      amenities: ["housing-network-captured"],
      location: { type: "Point", coordinates: [lon, lat] },
      locality_id: `housing-${this.citySlug}`,
      nearby_metro: pickFirstString(rawItem, ["nearbyMetro", "metro", "nearestMetro"]),
      commute_estimate_minutes: null,
      dedupe_key: dedupeKey,
      price_history: [
        {
          source: SourcePlatform.Housing,
          rent: rentValue,
          url: listingUrl,
          observed_at: now,
        },
      ],
      created_at: now,
      updated_at: now,
      is_active: true,
      scrape_run_id: this.runId,
      last_seen_at: now,
      inactive_since: null,
      raw_listing_id: propertyId,
      ingestion_method: "playwright-network-json",
    };
  }

  private extractListingUrl(item: Record<string, any>): string | null {
    for (const key of ["url", "detailUrl", "canonicalUrl", "seoUrl", "link"]) {
      const val = item[key];
      if (typeof val === "string" && val.trim()) {
        if (val.startsWith("http")) return val;
        if (val.startsWith("/")) return `https://housing.com${val}`;
      }
    }
    return null;
  }

  private inferPropertyType(item: Record<string, any>, title: string): string {
    const candidate = pickFirstString(item, ["propertyType", "type", "subType"]);
    const text = `${candidate || ""} ${title}`.toLowerCase();
    if (text.includes("pg") || text.includes("paying guest")) return "PG";
    if (text.includes("hostel")) return "hostel";
    if (text.includes("studio") || text.includes("1rk")) return "studio";
    if (text.includes("shared") || text.includes("room")) return "shared flat";
    return "apartment";
  }
}

async function main() {
  const program = new Command();
  program
    .description("Scrape Housing.com using Playwright and upsert listings into MongoDB.")
    .option("--city <city>", "City name", "Kolkata")
    .option("--search-url <urls...>", "Listing page URLs to visit")
    .option("--max-pages <number>", "Max pages", "2")
    .option("--wait-after-load-ms <number>", "Wait time after load", "3500")
    .option("--scroll-steps <number>", "Scroll steps", "6")
    .option("--timeout-ms <number>", "Timeout ms", "60000")
    .option("--headful", "Run browser with UI", false)
    .option("--storage-state <path>", "Storage state JSON path")
    .option("--limit <number>", "Max listings", "500")
    .option("--mongo-uri <uri>", "MongoDB URI", config.MONGODB_URI)
    .option("--mongo-db <db>", "MongoDB Database", config.MONGODB_DB)
    .option("--no-deactivate-stale", "Skip deactivating stale records", false)
    .option("--dry-run", "Collect only, do not write to DB", false);

  program.parse();
  const options = program.opts();

  const runId = `housing-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const urls = options.searchUrl || defaultSearchUrls(options.city);

  console.log(`[INFO] starting runId=${runId} city=${options.city}`);
  console.log(`[INFO] targets=${urls.join(", ")}`);

  const collector = new HousingNetworkCollector({
    maxPages: parseInt(options.maxPages, 10),
    waitAfterLoadMs: parseInt(options.waitAfterLoadMs, 10),
    scrollSteps: parseInt(options.scrollSteps, 10),
    storageStatePath: options.storageState,
  });

  const payloads = await collector.collect(
    urls,
    !options.headful,
    parseInt(options.timeoutMs, 10)
  );

  const normalizer = new HousingNormalizer(options.city, runId);
  const { normalized, skipped } = normalizer.normalizeMany(payloads, parseInt(options.limit, 10));

  let upsertedCount = 0;
  let staleMarkedCount = 0;

  if (options.dryRun) {
    console.log("[INFO] dry-run enabled, skipping DB writes");
  } else {
    const client = new MongoClient(options.mongoUri);
    try {
      await client.connect();
      const db = client.db(options.mongoDb);
      const coll = db.collection("properties");
      const observedKeys: string[] = [];
      const now = new Date().toISOString();

      for (const item of normalized) {
        observedKeys.push(item.dedupe_key);
        const { created_at, ...updateFields } = item;
        await coll.updateOne(
          { dedupe_key: item.dedupe_key },
          {
            $set: updateFields,
            $setOnInsert: { created_at: created_at || now, first_seen_at: now },
          },
          { upsert: true }
        );
        upsertedCount++;
      }

      if (options.deactivateStale) {
        const result = await coll.updateMany(
          {
            source_platform: SourcePlatform.Housing,
            dedupe_key: { $nin: observedKeys },
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
        staleMarkedCount = result.modifiedCount;
      }
    } finally {
      await client.close();
    }
  }

  console.log(
    `[COMPLETED] payloads=${payloads.length} normalized=${normalized.length} upserted=${upsertedCount} staleMarked=${staleMarkedCount} skipped=${skipped}`
  );
}

main().catch((err) => {
  console.error("Scraping failed:", err);
  process.exit(1);
});
