import axios from "axios";
import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";
import { PropertyRepository } from "../../repositories/properties.js";
import { AIAdvisor } from "../../services/aiAdvisor.js";
import { cacheKey, getJson, setJson } from "../../services/cache.js";
import { CommuteService } from "../../services/commute.js";
import { IntentParser } from "../../services/intentParser.js";
import { LowestPriceEngine } from "../../services/lowestPrice.js";
import { RecommendationEngine } from "../../services/recommendations.js";
import { vectorSearchService } from "../../services/vectorSearchService.js";

export const searchRouter = Router();

const SemanticSearchInSchema = z.object({
  query: z.string().min(1, "Query string is required"),
  city: z.string().optional(),
  locality: z.string().optional(),
  budget_max: z.number().optional(),
  budget_min: z.number().optional(),
  property_types: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
  threshold: z.number().min(0).max(1).default(0.45),
});

/**
 * POST /api/v1/search/semantic
 * Natural language semantic property search using OpenAI embeddings & hybrid ranking
 */
searchRouter.post("/semantic", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = SemanticSearchInSchema.parse(req.body);
    const result = await vectorSearchService.executeSemanticSearch(parsed);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    res.status(500).json({ error: (error as Error).message });
  }
});


searchRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.body?.query || "";
    const profile = req.body?.profile;
    const customWeights = req.body?.weights;
    const hardConstraints = req.body?.hard_constraints;

    const key = cacheKey("ai_search_v3", { query, profile, customWeights, hardConstraints });

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

    const officeCoordinates = intent.filters.office_location
      ? await resolveOfficeCoordinates(intent.filters.office_location, intent.filters.city)
      : null;

    const db = getDatabase();
    const propertyRepo = new PropertyRepository(db);
    const localityRepo = new LocalityRepository(db);

    let properties = await propertyRepo.search(intent.filters, 60, officeCoordinates);

    if (officeCoordinates) {
      rankByOfficeProximity(properties, officeCoordinates);
      properties = keepNearbyRelocationOptions(properties, 40, 15.0);
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

    // Calculate traffic and shuttle data for the primary search area
    const commuteService = new CommuteService();
    const topDistance = enriched[0]?.distance_to_office_km || 3.5;
    const topRoadDistance = enriched[0]?.road_distance_km || topDistance * 1.3;
    const originLocality = enriched[0]?.locality || intent.filters.office_location || "Selected Property";
    const destOffice = intent.filters.office_location || "Workplace";
    const trafficData = commuteService.calculateTrafficData(
      topDistance,
      topRoadDistance,
      intent.filters.city || "Kolkata",
      originLocality,
      destOffice
    );

    const result = {
      intent,
      office_coordinates: officeCoordinates ? [officeCoordinates[0], officeCoordinates[1]] : null,
      traffic_data: trafficData,
      shuttle_services: trafficData.shuttle_services,
      recommendations,
      properties: enriched,
    };

    // Log telemetry asynchronously
    import("../../services/analyticsService.js").then(({ analyticsService }) => {
      analyticsService.logSearchTelemetry({
        query,
        city: intent.filters.city || undefined,
        officeLocation: intent.filters.office_location || undefined,
        budgetMax: intent.filters.budget_max || undefined,
        propertyTypes: intent.filters.property_types || [],
        amenities: intent.filters.amenities || [],
        preferences: intent.filters.preferences || [],
        resultsCount: enriched.length,
        isCacheHit: false,
      }).catch(() => {});
    });

    await setJson(key, result, 300);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const CITY_CENTERS: Record<string, [number, number]> = {
  kolkata: [88.3639, 22.5726],
  bangalore: [77.5946, 12.9716],
  bengaluru: [77.5946, 12.9716],
  mumbai: [72.8777, 19.0760],
  pune: [73.8567, 18.5204],
  delhi: [77.2090, 28.6139],
  gurgaon: [77.0266, 28.4595],
  gurugram: [77.0266, 28.4595],
  noida: [77.3910, 28.5355],
  hyderabad: [78.4867, 17.3850],
  chennai: [80.2707, 13.0827],
};

export async function resolveOfficeCoordinates(
  officeLocation?: string | null,
  city?: string | null
): Promise<[number, number] | null> {
  if (!officeLocation) return null;

  const normalizedCity = (city || detectCity(officeLocation) || config.DEFAULT_CITY).trim();
  const known = knownOfficeCoordinates(officeLocation, normalizedCity);
  if (known) return known;

  const cityCenter = CITY_CENTERS[normalizedCity.toLowerCase()];

  // 1. Try Mapbox Geocoding with proximity biasing
  if (config.MAPBOX_ACCESS_TOKEN) {
    const coords = await geocodeWithMapbox(
      officeLocation,
      config.MAPBOX_ACCESS_TOKEN,
      normalizedCity,
      cityCenter
    );
    if (coords) return coords;
  }

  // 2. Try OpenStreetMap Nominatim
  const coords = await geocodeWithNominatim(officeLocation, normalizedCity);
  if (coords) return coords;

  // 3. Try AI LLM Spatial Geocoding for obscure sub-localities, lanes, roads, or colonies
  try {
    const aiAdvisor = new AIAdvisor();
    const aiCoords = await aiAdvisor.resolveLocationWithLLM(officeLocation, normalizedCity);
    if (aiCoords) return aiCoords;
  } catch {
    // Non-critical fallback
  }

  if (
    config.DEFAULT_OFFICE_HINT &&
    config.DEFAULT_OFFICE_HINT.toLowerCase() !== officeLocation.toLowerCase()
  ) {
    const knownDefault = knownOfficeCoordinates(config.DEFAULT_OFFICE_HINT, normalizedCity);
    if (knownDefault) return knownDefault;
    return geocodeWithNominatim(config.DEFAULT_OFFICE_HINT, normalizedCity);
  }

  return null;
}

export function knownOfficeCoordinates(
  officeLocation: string,
  city?: string | null
): [number, number] | null {
  const normalized = officeLocation.toLowerCase();
  const normalizedCity = (city || "").toLowerCase().trim();

  // ── KOLKATA TECH PARKS & SUB-LOCALITIES ──
  if (
    normalizedCity === "kolkata" ||
    normalized.includes("kolkata") ||
    normalized.includes("salt lake") ||
    normalized.includes("new town") ||
    normalized.includes("rajarhat") ||
    normalized.includes("sector v") ||
    normalized.includes("sector 5") ||
    normalized.includes("kestopur") ||
    normalized.includes("tarulia") ||
    normalized.includes("baguiati")
  ) {
    if (normalized.includes("tarulia") || normalized.includes("krishnapur")) {
      return [88.4380, 22.5870]; // Tarulia Lane / Krishnapur (near Kestopur & AA-1)
    }
    if (normalized.includes("kestopur")) {
      return [88.4350, 22.5920]; // Kestopur VIP Road Corridor
    }
    if (normalized.includes("baguiati") || normalized.includes("teghoria")) {
      return [88.4280, 22.6100]; // Baguiati / Teghoria
    }
    if (normalized.includes("lake town") || normalized.includes("bangur")) {
      return [88.4035, 22.6033]; // Lake Town
    }
    if (normalized.includes("rajarhat main road") || normalized.includes("chinar park")) {
      return [88.4412, 22.6237]; // Rajarhat Main Road / Chinar Park
    }
    if (normalized.includes("candor") || normalized.includes("unitech")) {
      return [88.4770, 22.5835]; // Candor TechSpace New Town AA-1 (Gates 1, 2, 3)
    }
    if (normalized.includes("ecospace")) {
      return [88.4740, 22.5880]; // Ecospace Business Park
    }
    if (normalized.includes("dlf 1") || normalized.includes("dlf-1") || normalized.includes("dlf i")) {
      return [88.4600, 22.5820];
    }
    if (normalized.includes("dlf 2") || normalized.includes("dlf-2") || normalized.includes("dlf ii")) {
      return [88.4710, 22.5950];
    }
    if (normalized.includes("astra tower") || normalized.includes("mani casadona")) {
      return [88.4670, 22.5930];
    }
    if (normalized.includes("gitobitan") || normalized.includes("tcs delta")) {
      return [88.4310, 22.5750];
    }
    if (normalized.includes("wipro")) {
      return [88.4340, 22.5740];
    }
    if (normalized.includes("godrej waterside") || normalized.includes("millennium city")) {
      return [88.4320, 22.5760];
    }
    if (normalized.includes("sector v") || normalized.includes("sector 5") || normalized.includes("salt lake")) {
      return [88.4335, 22.5762];
    }
    if (normalized.includes("new town") || normalized.includes("action area")) {
      return [88.4798, 22.5797];
    }
    if (normalized.includes("kasba") || normalized.includes("acropolis")) {
      return [88.3900, 22.5150];
    }
    if (normalized.includes("ballygunge")) {
      return [88.3659, 22.5280];
    }
  }

  // ── BANGALORE TECH PARKS & HUBS ──
  if (
    normalizedCity === "bangalore" ||
    normalizedCity === "bengaluru" ||
    normalized.includes("bangalore") ||
    normalized.includes("bengaluru") ||
    normalized.includes("bellandur") ||
    normalized.includes("whitefield") ||
    normalized.includes("electronic city")
  ) {
    if (normalized.includes("manyata")) return [77.6200, 13.0480];
    if (normalized.includes("bagmane tech park")) return [77.6590, 12.9830];
    if (normalized.includes("bagmane") || normalized.includes("bwtc")) return [77.6970, 12.9900];
    if (normalized.includes("ecospace") || normalized.includes("ecoworld") || normalized.includes("rmz")) return [77.6840, 12.9260];
    if (normalized.includes("prestige tech park")) return [77.6920, 12.9370];
    if (normalized.includes("embassy tech") || normalized.includes("techvillage")) return [77.6890, 12.9290];
    if (normalized.includes("itpl") || normalized.includes("whitefield")) return [77.7470, 12.9870];
    if (normalized.includes("electronic city") || normalized.includes("ecity")) return [77.6640, 12.8450];
  }

  // ── PUNE TECH PARKS & HUBS ──
  if (
    normalizedCity === "pune" ||
    normalized.includes("pune") ||
    normalized.includes("hinjawadi") ||
    normalized.includes("kharadi") ||
    normalized.includes("magarpatta")
  ) {
    if (normalized.includes("hinjawadi") || normalized.includes("hinjewadi")) return [73.7280, 18.5910];
    if (normalized.includes("magarpatta")) return [73.9290, 18.5160];
    if (normalized.includes("eon") || normalized.includes("kharadi") || normalized.includes("wtc pune")) return [73.9530, 18.5520];
    if (normalized.includes("commerzone") || normalized.includes("yerwada")) return [73.8860, 18.5580];
  }

  // ── MUMBAI TECH PARKS & HUBS ──
  if (
    normalizedCity === "mumbai" ||
    normalized.includes("mumbai") ||
    normalized.includes("bkc") ||
    normalized.includes("powai") ||
    normalized.includes("goregaon")
  ) {
    if (normalized.includes("bkc") || normalized.includes("bandra kurla")) return [72.8650, 19.0660];
    if (normalized.includes("nesco") || normalized.includes("goregaon")) return [72.8570, 19.1510];
    if (normalized.includes("mindspace")) return [72.8360, 19.1830];
    if (normalized.includes("powai") || normalized.includes("hiranandani")) return [72.9090, 19.1190];
  }

  // ── DELHI NCR / GURGAON / NOIDA ──
  if (
    normalized.includes("candor") &&
    (normalized.includes("gurgaon") ||
      normalized.includes("gurugram") ||
      normalized.includes("sector 21") ||
      normalized.includes("sector 48"))
  ) {
    return [77.0312, 28.4253];
  }
  if (
    normalized.includes("candor") &&
    (normalized.includes("noida") ||
      normalized.includes("sector 62") ||
      normalized.includes("sector 135"))
  ) {
    return [77.3620, 28.6270];
  }
  if (normalized.includes("cyber city") || normalized.includes("cyber hub")) {
    return [77.0888, 28.4950];
  }

  // ── FALLBACK CANDOR & SECTOR V IF UNSPECIFIED ──
  if (normalized.includes("candor")) {
    return [88.4770, 22.5835];
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
  token: string,
  city?: string | null,
  proximity?: [number, number]
): Promise<[number, number] | null> {
  const cleanCity = city?.trim();
  const qualifiedQuery =
    cleanCity && !query.toLowerCase().includes(cleanCity.toLowerCase())
      ? `${query}, ${cleanCity}`
      : query;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(qualifiedQuery)}.json`;
  try {
    const params: Record<string, any> = {
      access_token: token,
      country: "in",
      limit: 1,
      autocomplete: "true",
    };
    if (proximity && proximity.length >= 2) {
      params.proximity = `${proximity[0]},${proximity[1]}`;
    }

    const response = await axios.get(url, {
      params,
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

export async function geocodeWithNominatim(
  query: string,
  city?: string | null
): Promise<[number, number] | null> {
  const cleanCity = city?.trim();
  const qualified =
    cleanCity && !query.toLowerCase().includes(cleanCity.toLowerCase())
      ? `${query}, ${cleanCity}, India`
      : `${query}, India`;

  const url = "https://nominatim.openstreetmap.org/search";
  try {
    const response = await axios.get(url, {
      params: {
        q: qualified,
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
      const roadKm = distanceKm < 2.0 ? distanceKm * 1.2 : distanceKm * 1.32;
      item.distance_to_office_km = Number(distanceKm.toFixed(2));
      item.road_distance_km = Number(roadKm.toFixed(2));

      // Free-flow base driving speed ~32 km/h; peak rush speed ~16 km/h
      const baseDriving = Math.max(4, Math.round((roadKm / 32.0) * 60 + 3));
      const peakMorning = Math.round(baseDriving * 1.85);
      const peakEvening = Math.round(baseDriving * 1.95);
      const offPeak = Math.round(baseDriving * 1.15);

      item.off_peak_commute_minutes = offPeak;
      item.commute_estimate_minutes = peakMorning;
      item.peak_commute_minutes = peakMorning;
      item.peak_evening_minutes = peakEvening;
      item.metro_commute_minutes = Math.max(8, Math.round((roadKm / 35.0) * 60 + 8));
      item.bike_taxi_minutes = Math.max(3, Math.round((roadKm / 28.0) * 60 * 1.35 + 2));
    } else {
      item.distance_to_office_km = 999.0;
      item.road_distance_km = 999.0;
      item.commute_estimate_minutes = 45;
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
  maxItems: number = 40,
  maxRadiusKm: number = 15.0
): Record<string, any>[] {
  if (!properties || properties.length === 0) return properties;

  const valid = properties.filter((p) => (p.distance_to_office_km || 999.0) < 900);
  if (valid.length === 0) return properties.slice(0, maxItems);

  // Strictly filter to nearby properties within maxRadiusKm (e.g. 15 km max)
  const strictlyNearby = valid.filter(
    (item) => (item.distance_to_office_km || 999.0) <= maxRadiusKm
  );

  if (strictlyNearby.length >= 3) {
    return strictlyNearby.slice(0, maxItems);
  }

  // If very few candidates exist, return nearest available
  return valid.slice(0, maxItems);
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
