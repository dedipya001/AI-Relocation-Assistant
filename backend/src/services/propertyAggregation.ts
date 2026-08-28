import axios from "axios";
import crypto from "crypto";
import { config } from "../core/config.js";
import { logger } from "../core/logger.js";
import { SourcePlatform } from "../models/common.js";
import { Property } from "../models/property.js";

export interface ListingSourceInfo {
  id: string;
  name: string;
  role: string;
  ingestion_methods: string[];
  status: string;
  note: string;
}

export interface ListingProvider {
  source_id: string;
  source_platform: SourcePlatform;
  fetch(place: string, limit: number): Promise<Property[]>;
}

export class PropertyAggregationService {
  private providers: Record<string, ListingProvider>;

  constructor() {
    this.providers = {
      magicbricks: new MagicBricksProvider(),
      "99acres": new Acres99Provider(),
      nobroker: new NoBrokerProvider(),
      broker_crm: new BrokerCrmProvider(),
    };
  }

  async aggregate(
    place: string = "Sector V Kolkata",
    limit: number = 40,
    sources?: string[] | null
  ): Promise<Property[]> {
    const selected = this.selectedProviders(sources);
    const perSourceLimit = Math.max(5, Math.floor(limit / Math.max(1, selected.length)));

    const results = await Promise.allSettled(
      selected.map((provider) => provider.fetch(place, perSourceLimit))
    );

    const properties: Property[] = [];
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        properties.push(...result.value);
      } else {
        logger.warn(
          { source: selected[idx].source_id, error: result.reason?.message },
          "listing_provider_failed"
        );
      }
    });

    return this.dedupe(properties).slice(0, limit);
  }

  sources(): ListingSourceInfo[] {
    return [
      {
        id: "magicbricks",
        name: "MagicBricks",
        role: "bulk listings",
        ingestion_methods: ["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
        status: "adapter-ready",
        note: "Use partnership/API where possible; scraper hooks are isolated behind adapters.",
      },
      {
        id: "99acres",
        name: "99acres",
        role: "builder and broker inventory",
        ingestion_methods: ["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
        status: "adapter-ready",
        note: "Good for apartments, builder inventory, and broker-posted rentals.",
      },
      {
        id: "nobroker",
        name: "NoBroker",
        role: "owner-listed rentals",
        ingestion_methods: ["Apify actor", "BrightData collector", "Playwright scheduled scraper", "partner feed"],
        status: "adapter-ready",
        note: "Important source for lower-friction rentals and owner listings.",
      },
      {
        id: "broker_crm",
        name: "Broker CRM feeds",
        role: "fresh hyperlocal inventory",
        ingestion_methods: ["CSV feed", "JSON feed", "webhook", "manual upload"],
        status: "adapter-ready",
        note: "Most useful for fresh India locality inventory before public portals update.",
      },
      {
        id: "mapbox",
        name: "Mapbox",
        role: "geo intelligence",
        ingestion_methods: ["Mapbox geocoding/search"],
        status: "implemented separately",
        note: "Used for coordinates, map rendering, and locality/place context; not a listing marketplace.",
      },
      {
        id: "rera",
        name: "RERA",
        role: "legal verification",
        ingestion_methods: ["state RERA public datasets", "govt feeds", "scheduled sync"],
        status: "planned enrichment",
        note: "Use for project/legal verification, not rental discovery.",
      },
      {
        id: "census_open_govt",
        name: "Census/Open govt data",
        role: "demographics",
        ingestion_methods: ["open datasets", "scheduled sync"],
        status: "planned enrichment",
        note: "Use for locality demographics and civic scoring.",
      },
    ];
  }

  private selectedProviders(sources?: string[] | null): ListingProvider[] {
    const sourceIds = sources && sources.length > 0 ? sources : ["magicbricks", "99acres", "nobroker", "broker_crm"];
    const providers = sourceIds
      .map((id) => this.providers[id])
      .filter((p): p is ListingProvider => Boolean(p));

    return providers.length > 0 ? providers : Object.values(this.providers);
  }

  private dedupe(properties: Property[]): Property[] {
    const seen = new Set<string>();
    const unique: Property[] = [];

    for (const item of properties) {
      const coords = item.location?.coordinates || [0.0, 0.0];
      const key = `${item.title.toLowerCase()}:${coords[0].toFixed(4)}:${coords[1].toFixed(4)}:${item.rent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique.sort((a, b) => a.rent - b.rent);
  }
}

export abstract class PortalProvider implements ListingProvider {
  abstract source_id: string;
  abstract source_platform: SourcePlatform;
  abstract apifyActorSetting?: string;
  abstract brightdataDatasetSetting?: string;
  abstract sampleTitles: string[];

  async fetch(place: string, limit: number): Promise<Property[]> {
    const live = await this.fetchLive(place, limit);
    if (live.length > 0) {
      return live;
    }
    return this.sampleProperties(place, limit);
  }

  protected async fetchLive(place: string, limit: number): Promise<Property[]> {
    const apifyActorId = this.apifyActorSetting ? (config as any)[this.apifyActorSetting] : null;
    const brightdataDatasetId = this.brightdataDatasetSetting ? (config as any)[this.brightdataDatasetSetting] : null;

    if (config.APIFY_TOKEN && apifyActorId) {
      return this.fetchApify(apifyActorId, place, limit);
    }
    if (config.BRIGHTDATA_API_KEY && brightdataDatasetId) {
      return this.fetchBrightData(brightdataDatasetId, place, limit);
    }
    return [];
  }

  protected async fetchApify(actorId: string, place: string, limit: number): Promise<Property[]> {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;
    try {
      const response = await axios.post(
        url,
        { query: place, maxItems: limit, country: "IN" },
        { params: { token: config.APIFY_TOKEN }, timeout: 90000 }
      );
      const items = response.data || [];
      return items.slice(0, limit).map((item: any) => this.fromExternalItem(item, place, "Apify"));
    } catch {
      return [];
    }
  }

  protected async fetchBrightData(datasetId: string, place: string, limit: number): Promise<Property[]> {
    const url = `https://api.brightdata.com/datasets/v3/snapshot/${datasetId}`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${config.BRIGHTDATA_API_KEY}` },
        params: { format: "json", limit, query: place },
        timeout: 90000,
      });
      const items = response.data || [];
      return items.slice(0, limit).map((item: any) => this.fromExternalItem(item, place, "BrightData"));
    } catch {
      return [];
    }
  }

  fromExternalItem(item: Record<string, any>, place: string, ingestionMethod: string): Property {
    const title = item.title || item.name || `${this.source_platform} listing near ${place}`;
    const rent = parseInt(item.rent || item.price || estimatedRentFallback(this.source_platform, place, 0), 10);
    const coords = fallbackCoordinates(place);
    const lon = parseFloat(item.longitude || item.lng || coords[0]);
    const lat = parseFloat(item.latitude || item.lat || coords[1]);
    const propertyType = item.property_type || item.type || "apartment";
    const sourceUrl = item.url || item.source_url || null;
    const sourceId = stableId(this.source_id, title, lon, lat, rent);
    const now = new Date().toISOString();

    return {
      _id: sourceId,
      title,
      source_platform: this.source_platform,
      source_url: sourceUrl,
      property_type: propertyType,
      rent,
      deposit: item.deposit ? parseInt(item.deposit, 10) : rent,
      area_sqft: item.area_sqft ? parseInt(item.area_sqft, 10) : 500,
      furnishing: item.furnishing || "verification needed",
      images: item.images || [],
      amenities: [...(item.amenities || []), ingestionMethod],
      location: {
        type: "Point",
        coordinates: [lon, lat],
      },
      locality_id: stableLocalityId(place),
      nearby_metro: item.nearby_metro || "Nearest metro TBD",
      commute_estimate_minutes: item.commute_estimate_minutes || null,
      dedupe_key: sourceId,
      price_history: [{ source: this.source_platform, rent, url: sourceUrl, observed_at: now }],
      lowest_price: { source: this.source_platform, rent, url: sourceUrl, observed_at: now },
      created_at: now,
      updated_at: now,
    };
  }

  sampleProperties(place: string, limit: number): Property[] {
    const [baseLon, baseLat] = fallbackCoordinates(place);
    const now = new Date().toISOString();
    const properties: Property[] = [];

    this.sampleTitles.slice(0, limit).forEach((title, index) => {
      const lon = baseLon + (index - 1) * 0.012;
      const lat = baseLat + ((index % 3) - 1) * 0.009;
      const propertyType = propertyTypeFromTitle(title);
      const rent = estimatedRentFallback(propertyType, place, index);
      const sourceId = stableId(this.source_id, title, lon, lat, rent);

      properties.push({
        _id: sourceId,
        title,
        source_platform: this.source_platform,
        source_url: null,
        property_type: propertyType,
        rent,
        deposit: propertyType === "apartment" ? rent * 2 : rent,
        area_sqft: propertyType === "apartment" ? 520 : 160,
        furnishing: propertyType === "apartment" ? "semi-furnished" : "furnished",
        images: [],
        amenities: [
          this.source_platform,
          "sample normalized listing",
          "replace with Apify/BrightData/live feed",
        ],
        location: {
          type: "Point",
          coordinates: [lon, lat],
        },
        locality_id: stableLocalityId(place),
        nearby_metro: "Nearest metro TBD",
        commute_estimate_minutes: 12 + index * 7,
        dedupe_key: sourceId,
        price_history: [{ source: this.source_platform, rent, observed_at: now }],
        lowest_price: { source: this.source_platform, rent, observed_at: now },
        created_at: now,
        updated_at: now,
      });
    });

    return properties;
  }
}

export class MagicBricksProvider extends PortalProvider {
  source_id = "magicbricks";
  source_platform = SourcePlatform.MagicBricks;
  apifyActorSetting = "APIFY_MAGICBRICKS_ACTOR_ID";
  brightdataDatasetSetting = "BRIGHTDATA_MAGICBRICKS_DATASET_ID";
  sampleTitles = [
    "MagicBricks 1BHK near IT hub",
    "MagicBricks furnished studio close to metro",
    "MagicBricks shared flat in gated building",
    "MagicBricks 2BHK for working professionals",
  ];
}

export class Acres99Provider extends PortalProvider {
  source_id = "99acres";
  source_platform = SourcePlatform.Acres99;
  apifyActorSetting = "APIFY_99ACRES_ACTOR_ID";
  brightdataDatasetSetting = "BRIGHTDATA_99ACRES_DATASET_ID";
  sampleTitles = [
    "99acres builder floor near office corridor",
    "99acres apartment with power backup",
    "99acres compact rental near transit",
    "99acres owner-listed semi furnished flat",
  ];
}

export class NoBrokerProvider extends PortalProvider {
  source_id = "nobroker";
  source_platform = SourcePlatform.NoBroker;
  apifyActorSetting = "APIFY_NOBROKER_ACTOR_ID";
  brightdataDatasetSetting = "BRIGHTDATA_NOBROKER_DATASET_ID";
  sampleTitles = [
    "NoBroker owner-listed 1RK",
    "NoBroker no-brokerage 1BHK",
    "NoBroker furnished shared room",
    "NoBroker family apartment near main road",
  ];
}

export class BrokerCrmProvider implements ListingProvider {
  source_id = "broker_crm";
  source_platform = SourcePlatform.BrokerCRM;
  sampleTitles = [
    "Broker CRM fresh PG near office gate",
    "Broker CRM verified 1BHK with owner contact",
    "Broker CRM shared flat near metro",
    "Broker CRM co-living inventory from local agent",
  ];

  async fetch(place: string, limit: number): Promise<Property[]> {
    if (config.BROKER_CRM_FEED_URL) {
      return this.fetchFeed(place, limit);
    }
    const portal = new MagicBricksProvider();
    portal.source_id = this.source_id;
    portal.source_platform = this.source_platform;
    portal.sampleTitles = this.sampleTitles;
    return portal.sampleProperties(place, limit);
  }

  private async fetchFeed(place: string, limit: number): Promise<Property[]> {
    try {
      const response = await axios.get(config.BROKER_CRM_FEED_URL!, {
        params: { place, limit },
        timeout: 45000,
      });
      const items = response.data || [];
      const portal = new MagicBricksProvider();
      portal.source_id = this.source_id;
      portal.source_platform = this.source_platform;
      return items.slice(0, limit).map((item: any) => portal.fromExternalItem(item, place, "Broker CRM feed"));
    } catch {
      return [];
    }
  }
}

export function fallbackCoordinates(place: string): [number, number] {
  const text = place.toLowerCase();
  if (text.includes("kolkata") || text.includes("sector v") || text.includes("salt lake")) return [88.4335, 22.5762];
  if (text.includes("bangalore") || text.includes("bengaluru")) return [77.5946, 12.9716];
  if (text.includes("mumbai")) return [72.8777, 19.076];
  if (text.includes("delhi") || text.includes("gurgaon") || text.includes("gurugram")) return [77.1025, 28.7041];
  if (text.includes("pune")) return [73.8567, 18.5204];
  if (text.includes("hyderabad")) return [78.4867, 17.385];
  return [77.209, 28.6139];
}

export function propertyTypeFromTitle(title: string): string {
  const text = title.toLowerCase();
  if (text.includes("pg") || text.includes("room")) return "PG";
  if (text.includes("studio") || text.includes("1rk")) return "studio";
  if (text.includes("shared")) return "shared flat";
  return "apartment";
}

export function estimatedRentFallback(propertyType: string, place: string, seed: number | string): number {
  const baseByType: Record<string, number> = {
    PG: 9000,
    studio: 12500,
    "shared flat": 10500,
    apartment: 15500,
  };
  const base = baseByType[propertyType] || 13500;
  const isPremium = ["sector v", "salt lake", "indiranagar", "bandra", "hitech"].some((t) =>
    place.toLowerCase().includes(t)
  );
  const placeFactor = isPremium ? 1.1 : 1;

  let hash = 0;
  const str = `${propertyType}:${place}:${seed}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const adjustment = Math.floor((Math.abs(hash) % 4500) / 500) * 500;
  return Math.round((base * placeFactor + adjustment) / 500) * 500;
}

export function stableId(source: string, title: string, lon: number, lat: number, rent: number): string {
  const digest = crypto
    .createHash("sha1")
    .update(`${source}:${title}:${lon}:${lat}:${rent}`)
    .digest("hex")
    .slice(0, 12);
  return `${source}-${digest}`;
}

export function stableLocalityId(place: string): string {
  const slug = place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const digest = crypto.createHash("sha1").update(place).digest("hex").slice(0, 6);
  return `listing-${slug}-${digest}`;
}
