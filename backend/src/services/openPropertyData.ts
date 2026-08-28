import axios from "axios";
import crypto from "crypto";
import { config } from "../core/config.js";
import { logger } from "../core/logger.js";
import { SourcePlatform } from "../models/common.js";
import { Property } from "../models/property.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export interface PropertyLeadProvider {
  source: string;
  fetch(place: string, limit: number): Promise<Property[]>;
}

export class OpenPropertyDataService {
  private providers: Record<string, PropertyLeadProvider>;

  constructor() {
    this.providers = {
      osm: new OpenStreetMapPropertyProvider(),
      mapbox: new MapboxSearchPropertyProvider(),
    };
  }

  async fetchPropertyLeads(
    place: string = "Sector V Kolkata",
    limit: number = 25,
    sources?: string[] | null
  ): Promise<Property[]> {
    const selected = this.selectedProviders(sources);
    const perProviderLimit = Math.max(5, Math.floor(limit / Math.max(1, selected.length)));

    const results = await Promise.allSettled(
      selected.map((provider) => provider.fetch(place, perProviderLimit))
    );

    const properties: Property[] = [];
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        properties.push(...result.value);
      } else {
        logger.warn(
          { source: selected[idx].source, error: result.reason?.message },
          "property_provider_failed"
        );
      }
    });

    return this.dedupe(properties).slice(0, limit);
  }

  availableSources(): Array<{ id: string; name: string; kind: string; note: string }> {
    return [
      {
        id: "osm",
        name: "OpenStreetMap Overpass",
        kind: "open map data",
        note: "Finds mapped hostels, dormitories, apartment and residential buildings.",
      },
      {
        id: "mapbox",
        name: "Mapbox Geocoding/Search",
        kind: "map search",
        note: "Finds India POI/place leads for hostel, PG, co-living, and apartment-like searches.",
      },
      {
        id: "database",
        name: "Normalized Properties Collection",
        kind: "internal inventory",
        note: "Verified marketplace, broker, user-submitted, and scraped listings stored in MongoDB.",
      },
    ];
  }

  private selectedProviders(sources?: string[] | null): PropertyLeadProvider[] {
    const selectedIds = sources && sources.length > 0 ? sources : Object.keys(this.providers);
    const providers = selectedIds
      .map((id) => this.providers[id])
      .filter((p): p is PropertyLeadProvider => Boolean(p));

    return providers.length > 0 ? providers : Object.values(this.providers);
  }

  private dedupe(properties: Property[]): Property[] {
    const seen = new Set<string>();
    const unique: Property[] = [];

    for (const item of properties) {
      const coords = item.location?.coordinates || [0, 0];
      const key = `${item.title.toLowerCase()}:${coords[0].toFixed(4)}:${coords[1].toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique;
  }
}

export class OpenStreetMapPropertyProvider implements PropertyLeadProvider {
  source = "osm";

  async fetch(place: string, limit: number): Promise<Property[]> {
    const coordinates = await this.geocode(place);
    if (!coordinates) {
      return [];
    }
    const elements = await this.overpassPropertyCandidates(coordinates);
    return elements.slice(0, limit).map((el) => this.toProperty(el, place));
  }

  private async geocode(place: string): Promise<[number, number] | null> {
    try {
      const response = await axios.get(NOMINATIM_URL, {
        params: {
          q: `${place}, India`,
          format: "jsonv2",
          limit: 1,
          countrycodes: "in",
        },
        headers: { "User-Agent": config.SCRAPER_USER_AGENT },
        timeout: 20000,
      });

      const results = response.data;
      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    } catch {
      return null;
    }
  }

  private async overpassPropertyCandidates(coordinates: [number, number]): Promise<any[]> {
    const [lat, lon] = coordinates;
    const query = `
      [out:json][timeout:25];
      (
        node(around:4500,${lat},${lon})["tourism"="hostel"];
        way(around:4500,${lat},${lon})["tourism"="hostel"];
        relation(around:4500,${lat},${lon})["tourism"="hostel"];
        node(around:4500,${lat},${lon})["amenity"="hostel"];
        way(around:4500,${lat},${lon})["amenity"="hostel"];
        relation(around:4500,${lat},${lon})["amenity"="hostel"];
        node(around:4500,${lat},${lon})["building"~"apartments|residential|dormitory"];
        way(around:4500,${lat},${lon})["building"~"apartments|residential|dormitory"];
        relation(around:4500,${lat},${lon})["building"~"apartments|residential|dormitory"];
      );
      out center tags 80;
    `;

    try {
      const response = await axios.post(
        OVERPASS_URL,
        new URLSearchParams({ data: query }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 35000,
        }
      );
      return response.data?.elements || [];
    } catch {
      return [];
    }
  }

  private toProperty(element: any, place: string): Property {
    const tags = element.tags || {};
    const lat = element.lat ?? element.center?.lat ?? 0;
    const lon = element.lon ?? element.center?.lon ?? 0;
    const name = tags.name || this.fallbackName(tags, place);
    const propertyType = this.propertyType(tags);
    const rent = estimatedRent(propertyType, place, lat, lon);
    const sourceId = `osm-${element.type}-${element.id}`;
    const now = new Date().toISOString();
    const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;

    return {
      _id: sourceId,
      title: name,
      source_platform: SourcePlatform.OpenStreetMap,
      source_url: sourceUrl,
      property_type: propertyType,
      rent,
      deposit: rent,
      area_sqft: ["PG", "hostel", "co-living"].includes(propertyType) ? 160 : 520,
      furnishing: "verification needed",
      images: [],
      amenities: this.amenities(tags),
      location: {
        type: "Point",
        coordinates: [parseFloat(lon), parseFloat(lat)],
      },
      locality_id: stableLocalityId(place),
      nearby_metro: tags.station || "Nearest metro TBD",
      commute_estimate_minutes: null,
      dedupe_key: sourceId,
      price_history: [
        {
          source: SourcePlatform.OpenStreetMap,
          rent,
          url: sourceUrl,
          observed_at: now,
        },
      ],
      lowest_price: {
        source: SourcePlatform.OpenStreetMap,
        rent,
        url: sourceUrl,
        observed_at: now,
      },
      created_at: now,
      updated_at: now,
    };
  }

  private fallbackName(tags: Record<string, string>, place: string): string {
    const building = tags.building || "residential";
    return `${building.charAt(0).toUpperCase() + building.slice(1)} lead near ${place}`;
  }

  private propertyType(tags: Record<string, string>): string {
    if (tags.tourism === "hostel" || tags.amenity === "hostel") return "hostel";
    if (tags.building === "dormitory") return "PG";
    if (tags.building === "apartments") return "apartment";
    return "shared flat";
  }

  private amenities(tags: Record<string, string>): string[] {
    const am = ["OSM verified location", "price needs verification"];
    if (tags.internet_access) am.push("internet tagged");
    if (tags.wheelchair) am.push("accessibility tagged");
    if (tags.building === "apartments") am.push("residential building");
    return am;
  }
}

export class MapboxSearchPropertyProvider implements PropertyLeadProvider {
  source = "mapbox";

  async fetch(place: string, limit: number): Promise<Property[]> {
    const token = config.MAPBOX_ACCESS_TOKEN;
    if (!token) return [];

    const searchTerms = [
      `PG near ${place}`,
      `hostel near ${place}`,
      `co living near ${place}`,
      `apartment near ${place}`,
    ];

    const results = await Promise.allSettled(
      searchTerms.map((term) =>
        this.search(term, token, Math.max(2, Math.floor(limit / searchTerms.length)))
      )
    );

    const features: any[] = [];
    results.forEach((res) => {
      if (res.status === "fulfilled") {
        features.push(...res.value);
      }
    });

    return features.slice(0, limit).map((feat) => this.toProperty(feat, place));
  }

  private async search(query: string, token: string, limit: number): Promise<any[]> {
    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json`;
    try {
      const response = await axios.get(url, {
        params: {
          access_token: token,
          country: "in",
          limit: Math.min(limit, 10),
          types: "poi,address,place",
          autocomplete: "false",
        },
        timeout: 20000,
      });
      return response.data?.features || [];
    } catch {
      return [];
    }
  }

  private toProperty(feature: any, place: string): Property {
    const coordinates = feature.center || [0, 0];
    const name = feature.text || feature.place_name || `Mapbox lead near ${place}`;
    const context = feature.place_name || place;
    const propertyType = this.propertyType(name, context);
    const rent = estimatedRent(propertyType, place, coordinates[1], coordinates[0]);
    const hash = crypto.createHash("sha1").update(JSON.stringify(feature)).digest("hex").slice(0, 10);
    const sourceId = `mapbox-${feature.id || hash}`;
    const now = new Date().toISOString();

    return {
      _id: sourceId,
      title: `${name} near ${place}`,
      source_platform: SourcePlatform.Mapbox,
      source_url: null,
      property_type: propertyType,
      rent,
      deposit: rent,
      area_sqft: ["PG", "hostel", "co-living"].includes(propertyType) ? 160 : 500,
      furnishing: "verification needed",
      images: [],
      amenities: ["Mapbox search lead", "price needs verification", "India geocoded"],
      location: {
        type: "Point",
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
      },
      locality_id: stableLocalityId(place),
      nearby_metro: "Nearest transit TBD",
      commute_estimate_minutes: null,
      dedupe_key: sourceId,
      price_history: [{ source: SourcePlatform.Mapbox, rent, observed_at: now }],
      lowest_price: { source: SourcePlatform.Mapbox, rent, observed_at: now },
      created_at: now,
      updated_at: now,
    };
  }

  private propertyType(name: string, context: string): string {
    const text = `${name} ${context}`.toLowerCase();
    if (text.includes("pg") || text.includes("paying guest")) return "PG";
    if (text.includes("hostel")) return "hostel";
    if (text.includes("co") && text.includes("living")) return "co-living";
    if (text.includes("apartment") || text.includes("flat")) return "apartment";
    return "property lead";
  }
}

export function estimatedRent(
  propertyType: string,
  place: string,
  lat?: number | null,
  lon?: number | null
): number {
  const baseByType: Record<string, number> = {
    PG: 9500,
    hostel: 8500,
    "co-living": 11000,
    "shared flat": 12000,
    apartment: 15500,
  };
  const base = baseByType[propertyType] || 12500;
  const isPremiumPlace = ["sector v", "salt lake", "indiranagar", "bandra"].some((t) =>
    place.toLowerCase().includes(t)
  );
  const placeFactor = isPremiumPlace ? 1.08 : 1;
  let geoNoise = 0;
  if (lat && lon) {
    const rad = ((lat + lon) * Math.PI) / 180;
    geoNoise = Math.floor(Math.abs(Math.cos(rad)) * 2200);
  }
  return Math.round((base * placeFactor + geoNoise) / 500) * 500;
}

export function stableLocalityId(place: string): string {
  const slug = place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const digest = crypto.createHash("sha1").update(place).digest("hex").slice(0, 6);
  return `open-${slug}-${digest}`;
}
