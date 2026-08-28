import axios from "axios";
import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";
import { PropertyRepository } from "../../repositories/properties.js";
import { cacheKey, getJson, setJson } from "../../services/cache.js";
import { IntentParser } from "../../services/intentParser.js";
import { LowestPriceEngine } from "../../services/lowestPrice.js";
import { RecommendationEngine } from "../../services/recommendations.js";

export const searchRouter = Router();

searchRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.body?.query || "";
    const profile = req.body?.profile;
    const customWeights = req.body?.weights;
    const hardConstraints = req.body?.hard_constraints;

    const key = cacheKey("ai_search_v2", { query, profile, customWeights, hardConstraints });

    const cached = await getJson(key);
    if (cached) {
      res.json(cached);
      return;
    }

    const intent = await new IntentParser().parse(query);

    // City extraction from query or office location
    const detectedCity =
      detectCity(query) ||
      (intent.filters.office_location ? detectCity(intent.filters.office_location) : undefined);
    if (detectedCity && !intent.filters.city) {
      intent.filters.city = detectedCity;
    }

    const db = getDatabase();
    const propertyRepo = new PropertyRepository(db);
    const localityRepo = new LocalityRepository(db);

    let properties = await propertyRepo.search(intent.filters, 60);

    const officeCoordinates = intent.filters.office_location
      ? await resolveOfficeCoordinates(intent.filters.office_location)
      : null;

    if (officeCoordinates) {
      rankByOfficeProximity(properties, officeCoordinates);
      properties = keepNearbyRelocationOptions(properties);
    }

    const localityIds = Array.from(new Set(properties.map((p) => p.locality_id).filter(Boolean)));
    const localities =
      localityIds.length > 0
        ? await localityRepo.list({ _id: { $in: localityIds } } as any, 50)
        : [];

    const localitiesById: Record<string, any> = {};
    for (const loc of localities) {
      localitiesById[String(loc._id)] = loc;
    }

    const priceEngine = new LowestPriceEngine();
    const enriched = properties.map((prop) => priceEngine.attachLowestPrice(prop));

    const recommendations = new RecommendationEngine().rank(
      enriched,
      localitiesById,
      intent.filters.preferences,
      intent.filters.budget_max,
      {
        profile,
        customWeights,
        hardConstraints,
        preferences: intent.filters.preferences,
        budgetMax: intent.filters.budget_max,
      }
    );

    const result = {
      intent,
      office_coordinates: officeCoordinates ? [officeCoordinates[0], officeCoordinates[1]] : null,
      recommendations,
      properties: enriched,
    };

    await setJson(key, result, 300);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export async function resolveOfficeCoordinates(
  officeLocation?: string | null
): Promise<[number, number] | null> {
  if (!officeLocation) return null;

  const known = knownOfficeCoordinates(officeLocation);
  if (known) return known;

  if (config.MAPBOX_ACCESS_TOKEN) {
    const coords = await geocodeWithMapbox(officeLocation, config.MAPBOX_ACCESS_TOKEN);
    if (coords) return coords;
  }

  const coords = await geocodeWithNominatim(officeLocation);
  if (coords) return coords;

  if (
    config.DEFAULT_OFFICE_HINT &&
    config.DEFAULT_OFFICE_HINT.toLowerCase() !== officeLocation.toLowerCase()
  ) {
    const knownDefault = knownOfficeCoordinates(config.DEFAULT_OFFICE_HINT);
    if (knownDefault) return knownDefault;
    return geocodeWithNominatim(config.DEFAULT_OFFICE_HINT);
  }

  return null;
}

export function knownOfficeCoordinates(officeLocation: string): [number, number] | null {
  const normalized = officeLocation.toLowerCase();
  if (normalized.includes("candor") && normalized.includes("unitech")) {
    return [88.477, 22.58];
  }
  if (normalized.includes("sector v") || normalized.includes("salt lake")) {
    return [88.4335, 22.5762];
  }
  if (normalized.includes("new town")) {
    return [88.4798, 22.5797];
  }
  return null;
}

export async function geocodeWithMapbox(
  query: string,
  token: string
): Promise<[number, number] | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
  try {
    const response = await axios.get(url, {
      params: {
        access_token: token,
        country: "in",
        limit: 1,
        autocomplete: "true",
      },
      timeout: 15000,
    });
    const features = response.data?.features || [];
    if (features.length === 0) return null;
    const center = features[0].center;
    if (Array.isArray(center) && center.length >= 2) {
      return [parseFloat(center[0]), parseFloat(center[1])];
    }
  } catch {
    return null;
  }
  return null;
}

export async function geocodeWithNominatim(query: string): Promise<[number, number] | null> {
  const url = "https://nominatim.openstreetmap.org/search";
  try {
    const response = await axios.get(url, {
      params: {
        q: `${query}, India`,
        format: "jsonv2",
        limit: 1,
        countrycodes: "in",
      },
      headers: { "User-Agent": config.SCRAPER_USER_AGENT },
      timeout: 15000,
    });
    const rows = response.data;
    if (Array.isArray(rows) && rows.length > 0) {
      return [parseFloat(rows[0].lon), parseFloat(rows[0].lat)];
    }
  } catch {
    return null;
  }
  return null;
}

export function rankByOfficeProximity(
  properties: Record<string, any>[],
  officeCoordinates: [number, number]
): void {
  const [officeLon, officeLat] = officeCoordinates;

  for (const item of properties) {
    const coords = item.location?.coordinates || [];
    if (coords.length >= 2) {
      const distanceKm = haversineKm(officeLon, officeLat, Number(coords[0]), Number(coords[1]));
      item.distance_to_office_km = Number(distanceKm.toFixed(2));
      if (!item.commute_estimate_minutes) {
        item.commute_estimate_minutes = Math.max(6, Math.floor(distanceKm * 4 + 8));
      }
    } else {
      item.distance_to_office_km = 999.0;
    }
  }

  properties.sort((a, b) => {
    const distDiff = (a.distance_to_office_km || 999.0) - (b.distance_to_office_km || 999.0);
    if (distDiff !== 0) return distDiff;
    return (a.rent || 0) - (b.rent || 0);
  });
}

export function keepNearbyRelocationOptions(
  properties: Record<string, any>[],
  maxItems: number = 40
): Record<string, any>[] {
  if (!properties || properties.length === 0) return properties;

  const nearest = [...properties].sort(
    (a, b) => (a.distance_to_office_km || 999.0) - (b.distance_to_office_km || 999.0)
  );
  const anchor = nearest[0];
  const anchorCity = (anchor.city || "").trim().toLowerCase();

  const nearby: Record<string, any>[] = [];
  const radiusKm = 35.0;

  for (const item of nearest) {
    const distance = Number(item.distance_to_office_km || 999.0);
    const itemCity = (item.city || "").trim().toLowerCase();

    const cityMatches = Boolean(anchorCity) && itemCity === anchorCity;
    const isNear = distance <= radiusKm;
    if (cityMatches || isNear) {
      nearby.push(item);
    }
  }

  return (nearby.length > 0 ? nearby : nearest).slice(0, maxItems);
}

export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const radiusKm = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusKm * c;
}

export function detectCity(text?: string | null): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (
    lower.includes("bangalore") ||
    lower.includes("bengaluru") ||
    lower.includes("whitefield") ||
    lower.includes("hsr") ||
    lower.includes("koramangala") ||
    lower.includes("bellandur") ||
    lower.includes("indiranagar")
  ) {
    return "Bangalore";
  }
  if (
    lower.includes("kolkata") ||
    lower.includes("salt lake") ||
    lower.includes("sector v") ||
    lower.includes("new town") ||
    lower.includes("rajarhat") ||
    lower.includes("ballygunge")
  ) {
    return "Kolkata";
  }
  if (
    lower.includes("mumbai") ||
    lower.includes("powai") ||
    lower.includes("andheri") ||
    lower.includes("bandra") ||
    lower.includes("goregaon") ||
    lower.includes("thane")
  ) {
    return "Mumbai";
  }
  if (
    lower.includes("pune") ||
    lower.includes("hinjewadi") ||
    lower.includes("wakad") ||
    lower.includes("baner") ||
    lower.includes("kharadi") ||
    lower.includes("viman nagar") ||
    lower.includes("magarpatta")
  ) {
    return "Pune";
  }
  if (
    lower.includes("hyderabad") ||
    lower.includes("hitec") ||
    lower.includes("gachibowli") ||
    lower.includes("madhapur") ||
    lower.includes("kondapur") ||
    lower.includes("financial district")
  ) {
    return "Hyderabad";
  }
  return undefined;
}
