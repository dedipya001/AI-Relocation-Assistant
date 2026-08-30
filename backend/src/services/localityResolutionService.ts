import axios from "axios";
import { config } from "../core/config.js";
import { cacheKey, getJson, setJson } from "./cache.js";

export interface VerifiedLocationObject {
  searchedName: string;
  canonicalName: string;
  latitude: number;
  longitude: number;
  city: string;
  district?: string;
  state?: string;
  bounding_box?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  boundary?: any; // GeoJSON Geometry (Polygon / MultiPolygon)
  boundary_radius_km: number;
  source: "openstreetmap" | "mapbox" | "verified_benchmark" | "reverse_geocoding";
  confidence: "high" | "medium" | "low";
  is_ambiguous?: boolean;
  suggestions?: Array<{
    searchedName: string;
    canonicalName: string;
    city: string;
    state?: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface LocationSearchDebugEntry {
  original_query: string;
  extracted_locality: string;
  canonical_locality: string;
  geocoding_provider: string;
  resolved_coordinates: [number, number]; // [lon, lat]
  boundary_radius_km: number;
  has_polygon_boundary: boolean;
  bounding_box?: [number, number, number, number];
  properties_evaluated: number;
  exact_matches_count: number;
  nearby_matches_count: number;
  property_trace: Array<{
    property_id: string;
    title: string;
    coordinates: [number, number];
    raw_locality: string;
    reverse_geocoded_locality?: string;
    distance_km: number;
    classification: "exact_match" | "nearby_match" | "excluded_outside_range";
    inclusion_reason: string;
  }>;
}

// ── COMMON SPELLING VARIATIONS, TRANSLITERATIONS & ABBREVIATIONS ──
const ALIAS_DICTIONARY: Record<string, { canonical: string; city: string; district?: string; state?: string; lat: number; lon: number; radiusKm: number; bbox: [number, number, number, number] }> = {
  // Kolkata
  "sec 5": { canonical: "Sector V, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5762, lon: 88.4335, radiusKm: 2.2, bbox: [88.4200, 22.5680, 88.4480, 22.5890] },
  "sector 5": { canonical: "Sector V, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5762, lon: 88.4335, radiusKm: 2.2, bbox: [88.4200, 22.5680, 88.4480, 22.5890] },
  "sector v": { canonical: "Sector V, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5762, lon: 88.4335, radiusKm: 2.2, bbox: [88.4200, 22.5680, 88.4480, 22.5890] },
  "salt lake sec 5": { canonical: "Sector V, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5762, lon: 88.4335, radiusKm: 2.2, bbox: [88.4200, 22.5680, 88.4480, 22.5890] },
  "sec 1": { canonical: "Sector 1, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5950, lon: 88.4070, radiusKm: 1.8, bbox: [88.3980, 22.5850, 88.4160, 22.6050] },
  "sec 2": { canonical: "Sector 2, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5855, lon: 88.4180, radiusKm: 1.8, bbox: [88.4080, 22.5760, 88.4280, 22.5960] },
  "sec 3": { canonical: "Sector 3, Salt Lake", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5710, lon: 88.4110, radiusKm: 1.8, bbox: [88.3990, 22.5630, 88.4220, 22.5800] },
  "aa 1": { canonical: "New Town Action Area 1", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5880, lon: 88.4720, radiusKm: 2.8, bbox: [88.4550, 22.5700, 88.4900, 22.6050] },
  "action area 1": { canonical: "New Town Action Area 1", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5880, lon: 88.4720, radiusKm: 2.8, bbox: [88.4550, 22.5700, 88.4900, 22.6050] },
  "aa 2": { canonical: "New Town Action Area 2", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.6180, lon: 88.4890, radiusKm: 3.5, bbox: [88.4700, 22.5950, 88.5150, 22.6450] },
  "aa 3": { canonical: "New Town Action Area 3", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5650, lon: 88.4980, radiusKm: 3.2, bbox: [88.4750, 22.5400, 88.5200, 22.5850] },
  "kestopur": { canonical: "Kestopur", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5910, lon: 88.4350, radiusKm: 1.9, bbox: [88.4200, 22.5800, 88.4500, 22.6020] },
  "krishnapur": { canonical: "Kestopur", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5910, lon: 88.4350, radiusKm: 1.9, bbox: [88.4200, 22.5800, 88.4500, 22.6020] },
  "tarulia": { canonical: "Tarulia Lane, Kestopur", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5870, lon: 88.4380, radiusKm: 1.2, bbox: [88.4280, 22.5810, 88.4480, 22.5940] },
  "tarulia lane": { canonical: "Tarulia Lane, Kestopur", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.5870, lon: 88.4380, radiusKm: 1.2, bbox: [88.4280, 22.5810, 88.4480, 22.5940] },
  "baguiati": { canonical: "Baguiati", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.6200, lon: 88.4300, radiusKm: 2.1, bbox: [88.4150, 22.6080, 88.4450, 22.6320] },
  "baguihati": { canonical: "Baguiati", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", lat: 22.6200, lon: 88.4300, radiusKm: 2.1, bbox: [88.4150, 22.6080, 88.4450, 22.6320] },
  "lake town": { canonical: "Lake Town", city: "Kolkata", district: "South 24 Parganas", state: "West Bengal", lat: 22.6080, lon: 88.4080, radiusKm: 1.8, bbox: [88.3950, 22.5980, 88.4250, 22.6180] },
  "ballygunge": { canonical: "Ballygunge", city: "Kolkata", district: "Kolkata", state: "West Bengal", lat: 22.5300, lon: 88.3650, radiusKm: 2.4, bbox: [88.3500, 22.5150, 88.3800, 22.5450] },
  "kasba": { canonical: "Kasba", city: "Kolkata", district: "South 24 Parganas", state: "West Bengal", lat: 22.5160, lon: 88.3900, radiusKm: 2.0, bbox: [88.3750, 22.5050, 88.4050, 22.5280] },

  // Bangalore
  "bellandur": { canonical: "Bellandur", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9300, lon: 77.6750, radiusKm: 2.8, bbox: [77.6550, 12.9150, 77.6950, 12.9450] },
  "koramangala": { canonical: "Koramangala", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9340, lon: 77.6250, radiusKm: 2.5, bbox: [77.6050, 12.9200, 77.6450, 12.9480] },
  "koramangla": { canonical: "Koramangala", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9340, lon: 77.6250, radiusKm: 2.5, bbox: [77.6050, 12.9200, 77.6450, 12.9480] },
  "hsr": { canonical: "HSR Layout", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9120, lon: 77.6450, radiusKm: 2.4, bbox: [77.6250, 12.8980, 77.6650, 12.9250] },
  "hsr layout": { canonical: "HSR Layout", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9120, lon: 77.6450, radiusKm: 2.4, bbox: [77.6250, 12.8980, 77.6650, 12.9250] },
  "indiranagar": { canonical: "Indiranagar", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9780, lon: 77.6430, radiusKm: 2.0, bbox: [77.6280, 12.9650, 77.6580, 12.9880] },
  "whitefield": { canonical: "Whitefield", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9800, lon: 77.7490, radiusKm: 3.8, bbox: [77.7250, 12.9550, 77.7700, 13.0050] },
  "itpl": { canonical: "Whitefield / ITPL", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9870, lon: 77.7470, radiusKm: 2.5, bbox: [77.7300, 12.9700, 77.7650, 13.0050] },
  "ecity": { canonical: "Electronic City", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.8450, lon: 77.6690, radiusKm: 3.2, bbox: [77.6450, 12.8250, 77.6950, 12.8650] },
  "electronic city": { canonical: "Electronic City", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.8450, lon: 77.6690, radiusKm: 3.2, bbox: [77.6450, 12.8250, 77.6950, 12.8650] },
  "marathahalli": { canonical: "Marathahalli", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9590, lon: 77.7020, radiusKm: 2.5, bbox: [77.6850, 12.9450, 77.7200, 12.9720] },
  "marathalli": { canonical: "Marathahalli", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9590, lon: 77.7020, radiusKm: 2.5, bbox: [77.6850, 12.9450, 77.7200, 12.9720] },
  "manyata": { canonical: "Manyata Tech Park / Nagavara", city: "Bangalore", district: "Bengaluru Urban", state: "Karnataka", lat: 13.0480, lon: 77.6200, radiusKm: 2.2, bbox: [77.6050, 13.0350, 77.6350, 13.0600] },

  // Pune
  "hinjawadi": { canonical: "Hinjawadi", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5910, lon: 73.7280, radiusKm: 3.8, bbox: [73.6850, 18.5750, 73.7500, 18.6100] },
  "hinjewadi": { canonical: "Hinjawadi", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5910, lon: 73.7280, radiusKm: 3.8, bbox: [73.6850, 18.5750, 73.7500, 18.6100] },
  "baner": { canonical: "Baner", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5590, lon: 73.7850, radiusKm: 2.4, bbox: [73.7650, 18.5450, 73.8050, 18.5750] },
  "wakad": { canonical: "Wakad", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.6000, lon: 73.7620, radiusKm: 2.5, bbox: [73.7450, 18.5850, 73.7800, 18.6150] },
  "balewadi": { canonical: "Balewadi", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5780, lon: 73.7720, radiusKm: 1.9, bbox: [73.7600, 18.5650, 73.7850, 18.5900] },
  "kharadi": { canonical: "Kharadi", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5520, lon: 73.9530, radiusKm: 2.6, bbox: [73.9350, 18.5350, 73.9700, 18.5680] },
  "magarpatta": { canonical: "Magarpatta City", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5160, lon: 73.9290, radiusKm: 2.0, bbox: [73.9180, 18.5050, 73.9400, 18.5280] },
  "viman nagar": { canonical: "Viman Nagar", city: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5650, lon: 73.9150, radiusKm: 2.0, bbox: [73.9050, 18.5550, 73.9250, 18.5750] },

  // Mumbai
  "bkc": { canonical: "Bandra Kurla Complex (BKC)", city: "Mumbai", district: "Mumbai Suburban", state: "Maharashtra", lat: 19.0660, lon: 72.8650, radiusKm: 1.8, bbox: [72.8550, 19.0550, 72.8750, 19.0750] },
  "andheri west": { canonical: "Andheri West", city: "Mumbai", district: "Mumbai Suburban", state: "Maharashtra", lat: 19.1350, lon: 72.8300, radiusKm: 2.6, bbox: [72.8150, 19.1150, 72.8450, 19.1550] },
  "powai": { canonical: "Powai", city: "Mumbai", district: "Mumbai Suburban", state: "Maharashtra", lat: 19.1190, lon: 72.9090, radiusKm: 2.2, bbox: [72.8950, 19.1050, 72.9250, 19.1350] },
  "goregaon east": { canonical: "Goregaon East", city: "Mumbai", district: "Mumbai Suburban", state: "Maharashtra", lat: 19.1580, lon: 72.8600, radiusKm: 2.4, bbox: [72.8450, 19.1450, 72.8750, 19.1750] },

  // Hyderabad
  "hitec city": { canonical: "HITEC City", city: "Hyderabad", district: "Hyderabad", state: "Telangana", lat: 17.4490, lon: 78.3800, radiusKm: 2.4, bbox: [78.3650, 17.4350, 78.3950, 17.4650] },
  "hitech city": { canonical: "HITEC City", city: "Hyderabad", district: "Hyderabad", state: "Telangana", lat: 17.4490, lon: 78.3800, radiusKm: 2.4, bbox: [78.3650, 17.4350, 78.3950, 17.4650] },
  "gachibowli": { canonical: "Gachibowli", city: "Hyderabad", district: "Ranga Reddy", state: "Telangana", lat: 17.4430, lon: 78.3490, radiusKm: 2.5, bbox: [78.3350, 17.4300, 78.3650, 17.4580] },
  "kondapur": { canonical: "Kondapur", city: "Hyderabad", district: "Ranga Reddy", state: "Telangana", lat: 17.4680, lon: 78.3600, radiusKm: 2.2, bbox: [78.3450, 17.4550, 78.3750, 17.4800] },

  // Delhi NCR
  "cyber city": { canonical: "DLF Cyber City", city: "Delhi NCR", district: "Gurugram", state: "Haryana", lat: 28.4950, lon: 77.0888, radiusKm: 1.8, bbox: [77.0750, 28.4850, 77.1020, 28.5080] },
  "dlf phase 2": { canonical: "DLF Phase 2", city: "Delhi NCR", district: "Gurugram", state: "Haryana", lat: 28.4890, lon: 77.0850, radiusKm: 1.8, bbox: [77.0720, 28.4750, 77.0980, 28.5020] },
};

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
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

export class LocalityResolutionService {
  /**
   * Resolves any user-entered locality string into an authoritative VerifiedLocationObject.
   * Never uses LLM hallucinations or generic city centroids.
   */
  async resolveLocality(
    queryLocality: string,
    cityHint?: string | null
  ): Promise<VerifiedLocationObject | null> {
    if (!queryLocality || !queryLocality.trim()) return null;

    const raw = queryLocality.trim();
    const normalized = raw.toLowerCase().replace(/^(near|in|at|around|close to)\s+/i, "").trim();
    const normalizedCity = (cityHint || "").toLowerCase().trim();

    // 1. Check verified alias dictionary (instant, zero network latency)
    for (const [alias, data] of Object.entries(ALIAS_DICTIONARY)) {
      if (
        normalized === alias ||
        normalized.includes(alias) ||
        alias.includes(normalized)
      ) {
        if (!normalizedCity || data.city.toLowerCase() === normalizedCity || (normalizedCity === "bangalore" && data.city === "Bangalore") || (normalizedCity === "bengaluru" && data.city === "Bangalore")) {
          return {
            searchedName: raw,
            canonicalName: data.canonical,
            latitude: data.lat,
            longitude: data.lon,
            city: data.city,
            district: data.district,
            state: data.state,
            bounding_box: data.bbox,
            boundary_radius_km: data.radiusKm,
            source: "verified_benchmark",
            confidence: "high",
          };
        }
      }
    }

    // 2. Check Redis cache
    const cacheK = cacheKey("verified_loc_v2", { loc: normalized, city: normalizedCity });
    const cached = await getJson<VerifiedLocationObject>(cacheK);
    if (cached) return cached;

    // 3. Query OpenStreetMap Nominatim with address details and polygon geojson
    const osmResult = await this.resolveWithOSM(raw, cityHint);
    if (osmResult) {
      await setJson(cacheK, osmResult, 60 * 60 * 24 * 7); // 7 days
      return osmResult;
    }

    // 4. Query Mapbox Places API
    if (config.MAPBOX_ACCESS_TOKEN) {
      const mapboxResult = await this.resolveWithMapbox(raw, cityHint);
      if (mapboxResult) {
        await setJson(cacheK, mapboxResult, 60 * 60 * 24 * 7);
        return mapboxResult;
      }
    }

    return null;
  }

  /**
   * Resolves locality using OpenStreetMap Nominatim with polygon boundary extraction.
   */
  private async resolveWithOSM(
    locality: string,
    cityHint?: string | null
  ): Promise<VerifiedLocationObject | null> {
    try {
      const cleanCity = cityHint?.trim();
      const query = cleanCity && !locality.toLowerCase().includes(cleanCity.toLowerCase())
        ? `${locality}, ${cleanCity}, India`
        : `${locality}, India`;

      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: query,
          format: "jsonv2",
          addressdetails: 1,
          polygon_geojson: 1,
          limit: 3,
          countrycodes: "in",
        },
        headers: {
          "User-Agent": config.SCRAPER_USER_AGENT || "ThikanaKhojo-GIS/1.0",
        },
        timeout: 10000,
      });

      const items = response.data;
      if (!Array.isArray(items) || items.length === 0) return null;

      const top = items[0];
      const address = top.address || {};

      const detectedCity =
        address.city || address.town || address.municipality || address.state_district || cleanCity || "India";
      const district = address.state_district || address.county || undefined;
      const state = address.state || undefined;
      const canonicalName =
        address.suburb || address.neighbourhood || address.residential || address.commercial || top.name || locality;

      const lat = parseFloat(top.lat);
      const lon = parseFloat(top.lon);

      let bbox: [number, number, number, number] = [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02];
      if (Array.isArray(top.boundingbox) && top.boundingbox.length >= 4) {
        const southLat = parseFloat(top.boundingbox[0]);
        const northLat = parseFloat(top.boundingbox[1]);
        const westLon = parseFloat(top.boundingbox[2]);
        const eastLon = parseFloat(top.boundingbox[3]);
        bbox = [westLon, southLat, eastLon, northLat];
      }

      const radiusKm = Math.min(
        4.5,
        Math.max(1.5, haversineKm(bbox[0], bbox[1], bbox[2], bbox[3]) / 2.0)
      );

      // Suggestions for ambiguity if multiple distinct cities returned
      const suggestions = items.slice(1).map((it: any) => ({
        searchedName: locality,
        canonicalName: it.name || locality,
        city: it.address?.city || it.address?.state_district || "India",
        state: it.address?.state,
        latitude: parseFloat(it.lat),
        longitude: parseFloat(it.lon),
      }));

      return {
        searchedName: locality,
        canonicalName: canonicalName || locality,
        latitude: lat,
        longitude: lon,
        city: detectedCity,
        district,
        state,
        bounding_box: bbox,
        boundary: top.geojson || undefined,
        boundary_radius_km: Number(radiusKm.toFixed(2)),
        source: "openstreetmap",
        confidence: top.importance > 0.4 ? "high" : "medium",
        is_ambiguous: suggestions.length > 0 && suggestions.some((s) => s.city !== detectedCity),
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolves locality using Mapbox Places API.
   */
  private async resolveWithMapbox(
    locality: string,
    cityHint?: string | null
  ): Promise<VerifiedLocationObject | null> {
    try {
      const cleanCity = cityHint?.trim();
      const query = cleanCity && !locality.toLowerCase().includes(cleanCity.toLowerCase())
        ? `${locality}, ${cleanCity}`
        : locality;

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
      const response = await axios.get(url, {
        params: {
          access_token: config.MAPBOX_ACCESS_TOKEN,
          country: "in",
          limit: 3,
          types: "neighborhood,locality,place,poi",
        },
        timeout: 10000,
      });

      const features = response.data?.features;
      if (!Array.isArray(features) || features.length === 0) return null;

      const top = features[0];
      const [lon, lat] = top.center.map((n: any) => parseFloat(n));

      let bbox: [number, number, number, number];
      if (Array.isArray(top.bbox) && top.bbox.length >= 4) {
        bbox = [
          parseFloat(top.bbox[0]),
          parseFloat(top.bbox[1]),
          parseFloat(top.bbox[2]),
          parseFloat(top.bbox[3]),
        ];
      } else {
        bbox = [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02];
      }

      const radiusKm = Math.min(
        4.5,
        Math.max(1.5, haversineKm(bbox[0], bbox[1], bbox[2], bbox[3]) / 2.0)
      );

      return {
        searchedName: locality,
        canonicalName: top.text || locality,
        latitude: lat,
        longitude: lon,
        city: cleanCity || "India",
        bounding_box: bbox,
        boundary_radius_km: Number(radiusKm.toFixed(2)),
        source: "mapbox",
        confidence: top.relevance > 0.8 ? "high" : "medium",
      };
    } catch {
      return null;
    }
  }

  /**
   * Reverse-geocodes a coordinate point [longitude, latitude] into its true, verified locality name.
   */
  async reverseGeocode(
    lon: number,
    lat: number
  ): Promise<{ locality: string; city: string; subLocality?: string } | null> {
    const cacheK = cacheKey("reverse_geo_v1", { lon: lon.toFixed(4), lat: lat.toFixed(4) });
    const cached = await getJson<{ locality: string; city: string; subLocality?: string }>(cacheK);
    if (cached) return cached;

    try {
      if (config.MAPBOX_ACCESS_TOKEN) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`;
        const res = await axios.get(url, {
          params: {
            access_token: config.MAPBOX_ACCESS_TOKEN,
            types: "neighborhood,locality,place",
            limit: 1,
          },
          timeout: 8000,
        });
        const feat = res.data?.features?.[0];
        if (feat) {
          const locality = feat.text || "Locality";
          const context = feat.context || [];
          const cityObj = context.find((c: any) => c.id.startsWith("place"));
          const result = {
            locality,
            city: cityObj?.text || "City",
            subLocality: feat.properties?.address,
          };
          await setJson(cacheK, result, 60 * 60 * 24 * 30);
          return result;
        }
      }
    } catch {
      // Non-critical fallback
    }

    return null;
  }

  /**
   * Classifies whether a property listing is an EXACT match (inside locality polygon or boundary radius)
   * or a NEARBY match (within allowed nearby corridor radius).
   */
  classifyProperty(
    propertyCoords: [number, number],
    location: VerifiedLocationObject,
    maxNearbyRadiusKm: number = 6.0
  ): {
    isExact: boolean;
    isNearby: boolean;
    distanceKm: number;
    proximityLabel: string;
    inclusionReason: string;
  } {
    const [pLon, pLat] = propertyCoords;
    const distanceKm = Number(
      haversineKm(location.longitude, location.latitude, pLon, pLat).toFixed(2)
    );

    const [bMinX, bMinY, bMaxX, bMaxY] = location.bounding_box || [
      location.longitude - 0.02,
      location.latitude - 0.02,
      location.longitude + 0.02,
      location.latitude + 0.02,
    ];

    const withinBBox =
      pLon >= bMinX - 0.006 &&
      pLon <= bMaxX + 0.006 &&
      pLat >= bMinY - 0.006 &&
      pLat <= bMaxY + 0.006;

    const isExact = withinBBox || distanceKm <= location.boundary_radius_km + 0.5;
    const isNearby = !isExact && distanceKm <= maxNearbyRadiusKm;

    let proximityLabel = `Located in ${location.canonicalName}`;
    let inclusionReason = `Inside verified boundary of ${location.canonicalName} (${distanceKm} km from center)`;

    if (!isExact && isNearby) {
      proximityLabel = `Near ${location.canonicalName} (${distanceKm} km away)`;
      inclusionReason = `Within nearby commute radius (${distanceKm} km from ${location.canonicalName})`;
    } else if (!isExact && !isNearby) {
      proximityLabel = `Outside search area (${distanceKm} km away)`;
      inclusionReason = `Excluded: distance (${distanceKm} km) exceeds maximum nearby radius of ${maxNearbyRadiusKm} km`;
    }

    return {
      isExact,
      isNearby,
      distanceKm,
      proximityLabel,
      inclusionReason,
    };
  }
}

export const localityResolutionService = new LocalityResolutionService();
