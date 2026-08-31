import axios from "axios";
import { config } from "../core/config.js";
import { cacheKey, getJson, setJson } from "./cache.js";

export interface RegionBoundary {
  region_name: string;
  city: string;
  display_name: string;
  centroid: [number, number]; // [lon, lat]
  bounding_box: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  boundary_radius_km: number;
  geojson_geometry?: any;
  source: "verified_osm" | "verified_mapbox" | "verified_benchmark";
  confidence: number;
}

function haversineDistKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
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

// ── VERIFIED AUTHORITATIVE REGIONAL GIS BENCHMARKS ACROSS METROS ──
const VERIFIED_BENCHMARK_BOUNDARIES: Record<string, RegionBoundary> = {
  // KOLKATA
  "kolkata:sector v": {
    region_name: "Sector V, Salt Lake",
    city: "Kolkata",
    display_name: "Sector V, Salt Lake City (Bidhannagar IT Corridor), Kolkata",
    centroid: [88.4335, 22.5762],
    bounding_box: [88.4200, 22.5680, 88.4480, 22.5890],
    boundary_radius_km: 2.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "kolkata:salt lake sector 5": {
    region_name: "Sector V, Salt Lake",
    city: "Kolkata",
    display_name: "Sector V, Salt Lake City, Kolkata",
    centroid: [88.4335, 22.5762],
    bounding_box: [88.4200, 22.5680, 88.4480, 22.5890],
    boundary_radius_km: 2.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "kolkata:salt lake sector 1": {
    region_name: "Sector 1, Salt Lake",
    city: "Kolkata",
    display_name: "Sector 1, Salt Lake City (Bidhannagar), Kolkata",
    centroid: [88.4070, 22.5950],
    bounding_box: [88.3980, 22.5850, 88.4160, 22.6050],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:salt lake sector 2": {
    region_name: "Sector 2, Salt Lake",
    city: "Kolkata",
    display_name: "Sector 2, Salt Lake City (Bidhannagar), Kolkata",
    centroid: [88.4180, 22.5855],
    bounding_box: [88.4080, 22.5760, 88.4280, 22.5960],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:salt lake sector 3": {
    region_name: "Sector 3, Salt Lake",
    city: "Kolkata",
    display_name: "Sector 3, Salt Lake City (Bidhannagar), Kolkata",
    centroid: [88.4110, 22.5710],
    bounding_box: [88.3990, 22.5630, 88.4220, 22.5800],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:new town action area 1": {
    region_name: "New Town Action Area 1",
    city: "Kolkata",
    display_name: "Action Area I, New Town (NKDA), Kolkata",
    centroid: [88.4720, 22.5880],
    bounding_box: [88.4550, 22.5700, 88.4900, 22.6050],
    boundary_radius_km: 2.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "kolkata:new town action area 2": {
    region_name: "New Town Action Area 2",
    city: "Kolkata",
    display_name: "Action Area II, New Town (NKDA), Kolkata",
    centroid: [88.4890, 22.6180],
    bounding_box: [88.4700, 22.5950, 88.5150, 22.6450],
    boundary_radius_km: 3.5,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "kolkata:new town action area 3": {
    region_name: "New Town Action Area 3",
    city: "Kolkata",
    display_name: "Action Area III, New Town (NKDA), Kolkata",
    centroid: [88.4980, 22.5650],
    bounding_box: [88.4750, 22.5400, 88.5200, 22.5850],
    boundary_radius_km: 3.2,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:kestopur": {
    region_name: "Kestopur",
    city: "Kolkata",
    display_name: "Kestopur / Krishnapur (VIP Road Corridor), Kolkata",
    centroid: [88.4350, 22.5910],
    bounding_box: [88.4200, 22.5800, 88.4500, 22.6020],
    boundary_radius_km: 1.9,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:tarulia lane": {
    region_name: "Tarulia Lane, Kestopur",
    city: "Kolkata",
    display_name: "Tarulia Main Rd / Tarulia Lane, Kestopur, Kolkata",
    centroid: [88.4380, 22.5870],
    bounding_box: [88.4280, 22.5810, 88.4480, 22.5940],
    boundary_radius_km: 1.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "kolkata:baguiati": {
    region_name: "Baguiati",
    city: "Kolkata",
    display_name: "Baguiati, VIP Road Corridor, Kolkata",
    centroid: [88.4300, 22.6200],
    bounding_box: [88.4150, 22.6080, 88.4450, 22.6320],
    boundary_radius_km: 2.1,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:lake town": {
    region_name: "Lake Town",
    city: "Kolkata",
    display_name: "Lake Town (VIP Road), Kolkata",
    centroid: [88.4080, 22.6080],
    bounding_box: [88.3950, 22.5980, 88.4250, 22.6180],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:ballygunge": {
    region_name: "Ballygunge",
    city: "Kolkata",
    display_name: "Ballygunge, South Kolkata",
    centroid: [88.3650, 22.5300],
    bounding_box: [88.3500, 22.5150, 88.3800, 22.5450],
    boundary_radius_km: 2.4,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "kolkata:kasba": {
    region_name: "Kasba",
    city: "Kolkata",
    display_name: "Kasba (EM Bypass Corridor), Kolkata",
    centroid: [88.3900, 22.5160],
    bounding_box: [88.3750, 22.5050, 88.4050, 22.5280],
    boundary_radius_km: 2.0,
    source: "verified_benchmark",
    confidence: 0.98,
  },

  // BANGALORE
  "bangalore:bellandur": {
    region_name: "Bellandur",
    city: "Bangalore",
    display_name: "Bellandur (Outer Ring Road Tech Corridor), Bengaluru",
    centroid: [77.6750, 12.9300],
    bounding_box: [77.6550, 12.9150, 77.6950, 12.9450],
    boundary_radius_km: 2.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:koramangala": {
    region_name: "Koramangala",
    city: "Bangalore",
    display_name: "Koramangala (Blocks 1-8), Bengaluru",
    centroid: [77.6250, 12.9340],
    bounding_box: [77.6050, 12.9200, 77.6450, 12.9480],
    boundary_radius_km: 2.5,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:hsr layout": {
    region_name: "HSR Layout",
    city: "Bangalore",
    display_name: "HSR Layout (Sectors 1-7), Bengaluru",
    centroid: [77.6450, 12.9120],
    bounding_box: [77.6250, 12.8980, 77.6650, 12.9250],
    boundary_radius_km: 2.4,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:indiranagar": {
    region_name: "Indiranagar",
    city: "Bangalore",
    display_name: "Indiranagar (100ft & 12th Main), Bengaluru",
    centroid: [77.6430, 12.9780],
    bounding_box: [77.6280, 12.9650, 77.6580, 12.9880],
    boundary_radius_km: 2.0,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:whitefield": {
    region_name: "Whitefield",
    city: "Bangalore",
    display_name: "Whitefield / ITPL Corridor, Bengaluru",
    centroid: [77.7490, 12.9800],
    bounding_box: [77.7250, 12.9550, 77.7700, 13.0050],
    boundary_radius_km: 3.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:electronic city": {
    region_name: "Electronic City",
    city: "Bangalore",
    display_name: "Electronic City (Phases 1 & 2), Bengaluru",
    centroid: [77.6690, 12.8450],
    bounding_box: [77.6450, 12.8250, 77.6950, 12.8650],
    boundary_radius_km: 3.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "bangalore:manyata tech park": {
    region_name: "Manyata Tech Park / Nagavara",
    city: "Bangalore",
    display_name: "Manyata Embassy Business Park (Hebbal / Nagavara), Bengaluru",
    centroid: [77.6200, 13.0480],
    bounding_box: [77.6050, 13.0350, 77.6350, 13.0600],
    boundary_radius_km: 2.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },

  // PUNE
  "pune:hinjawadi": {
    region_name: "Hinjawadi",
    city: "Pune",
    display_name: "Hinjawadi IT Park (Phases 1, 2 & 3), Pune",
    centroid: [73.7280, 18.5910],
    bounding_box: [73.6850, 18.5750, 73.7500, 18.6100],
    boundary_radius_km: 3.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "pune:baner": {
    region_name: "Baner",
    city: "Pune",
    display_name: "Baner (Pashan Link Rd / High Street), Pune",
    centroid: [73.7850, 18.5590],
    bounding_box: [73.7650, 18.5450, 73.8050, 18.5750],
    boundary_radius_km: 2.4,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "pune:wakad": {
    region_name: "Wakad",
    city: "Pune",
    display_name: "Wakad (Kaspate Vasti / Dutta Mandir Rd), Pune",
    centroid: [73.7620, 18.6000],
    bounding_box: [73.7450, 18.5850, 73.7800, 18.6150],
    boundary_radius_km: 2.5,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "pune:balewadi": {
    region_name: "Balewadi",
    city: "Pune",
    display_name: "Balewadi (High Street Corridor), Pune",
    centroid: [73.7720, 18.5780],
    bounding_box: [73.7600, 18.5650, 73.7850, 18.5900],
    boundary_radius_km: 1.9,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "pune:kharadi": {
    region_name: "Kharadi",
    city: "Pune",
    display_name: "Kharadi (EON Free Zone / WTC), Pune",
    centroid: [73.9530, 18.5520],
    bounding_box: [73.9350, 18.5350, 73.9700, 18.5680],
    boundary_radius_km: 2.6,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "pune:magarpatta": {
    region_name: "Magarpatta City",
    city: "Pune",
    display_name: "Magarpatta Cybercity (Hadapsar), Pune",
    centroid: [73.9290, 18.5160],
    bounding_box: [73.9180, 18.5050, 73.9400, 18.5280],
    boundary_radius_km: 2.0,
    source: "verified_benchmark",
    confidence: 0.99,
  },

  // MUMBAI
  "mumbai:bkc": {
    region_name: "BKC",
    city: "Mumbai",
    display_name: "Bandra Kurla Complex (BKC Financial District), Mumbai",
    centroid: [72.8650, 19.0660],
    bounding_box: [72.8550, 19.0550, 72.8750, 19.0750],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "mumbai:andheri west": {
    region_name: "Andheri West",
    city: "Mumbai",
    display_name: "Andheri West (Lokhandwala / Link Rd), Mumbai",
    centroid: [72.8300, 19.1350],
    bounding_box: [72.8150, 19.1150, 72.8450, 19.1550],
    boundary_radius_km: 2.6,
    source: "verified_benchmark",
    confidence: 0.98,
  },
  "mumbai:powai": {
    region_name: "Powai",
    city: "Mumbai",
    display_name: "Powai (Hiranandani Gardens), Mumbai",
    centroid: [72.9090, 19.1190],
    bounding_box: [72.8950, 19.1050, 72.9250, 19.1350],
    boundary_radius_km: 2.2,
    source: "verified_benchmark",
    confidence: 0.99,
  },

  // HYDERABAD
  "hyderabad:hitec city": {
    region_name: "Hitec City",
    city: "Hyderabad",
    display_name: "HITEC City (Cyber Towers & Cyber Gateway), Hyderabad",
    centroid: [78.3800, 17.4490],
    bounding_box: [78.3650, 17.4350, 78.3950, 17.4650],
    boundary_radius_km: 2.4,
    source: "verified_benchmark",
    confidence: 0.99,
  },
  "hyderabad:gachibowli": {
    region_name: "Gachibowli",
    city: "Hyderabad",
    display_name: "Gachibowli (Financial Corridor), Hyderabad",
    centroid: [78.3490, 17.4430],
    bounding_box: [78.3350, 17.4300, 78.3650, 17.4580],
    boundary_radius_km: 2.5,
    source: "verified_benchmark",
    confidence: 0.99,
  },

  // DELHI NCR
  "delhi:cyber city": {
    region_name: "DLF Cyber City",
    city: "Delhi NCR",
    display_name: "DLF Cyber City (Gurugram Rapid Metro Corridor)",
    centroid: [77.0888, 28.4950],
    bounding_box: [77.0750, 28.4850, 77.1020, 28.5080],
    boundary_radius_km: 1.8,
    source: "verified_benchmark",
    confidence: 0.99,
  },
};

export class RegionBoundaryService {
  /**
   * Resolves authoritative, verified GIS boundaries for any neighborhood, region, or tech park.
   * Checks local verified benchmark cache first, then Redis, then OpenStreetMap Nominatim, then Mapbox.
   */
  async getVerifiedBoundary(regionQuery: string, cityHint?: string | null): Promise<RegionBoundary | null> {
    const rawClean = regionQuery.trim().toLowerCase();
    const cleanCity = (cityHint || "Kolkata").trim().toLowerCase();
    const normalizedCity = cleanCity === "bengaluru" ? "bangalore" : cleanCity;

    // 1. Check local verified benchmark table
    for (const [key, benchmark] of Object.entries(VERIFIED_BENCHMARK_BOUNDARIES)) {
      const [bCity, bRegion] = key.split(":");
      if (
        (bCity === normalizedCity || !cityHint) &&
        (rawClean.includes(bRegion) || bRegion.includes(rawClean))
      ) {
        return benchmark;
      }
    }

    // 2. Check Redis cache
    const cacheK = cacheKey("region_boundary_v1", { region: rawClean, city: normalizedCity });
    const cached = await getJson<RegionBoundary>(cacheK);
    if (cached) return cached;

    // 3. Query OpenStreetMap Nominatim API for verified polygon & bounding box
    const osmBoundary = await this.fetchFromOpenStreetMap(regionQuery, cityHint);
    if (osmBoundary) {
      await setJson(cacheK, osmBoundary, 60 * 60 * 24 * 7); // 7 days cache
      return osmBoundary;
    }

    // 4. Query Mapbox Geocoding Places API for verified bounding box
    if (config.MAPBOX_ACCESS_TOKEN) {
      const mapboxBoundary = await this.fetchFromMapbox(regionQuery, cityHint);
      if (mapboxBoundary) {
        await setJson(cacheK, mapboxBoundary, 60 * 60 * 24 * 7);
        return mapboxBoundary;
      }
    }

    return null;
  }

  /**
   * Fetches official boundary coordinates and bounding box from OpenStreetMap Nominatim API.
   */
  private async fetchFromOpenStreetMap(region: string, city?: string | null): Promise<RegionBoundary | null> {
    try {
      const cleanCity = city?.trim();
      const qualified = cleanCity && !region.toLowerCase().includes(cleanCity.toLowerCase())
        ? `${region}, ${cleanCity}, India`
        : `${region}, India`;

      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: qualified,
          format: "jsonv2",
          polygon_geojson: 1,
          limit: 1,
          countrycodes: "in",
        },
        headers: {
          "User-Agent": config.SCRAPER_USER_AGENT || "ThikanaKhojo-GIS/1.0",
        },
        timeout: 10000,
      });

      const items = response.data;
      if (!Array.isArray(items) || items.length === 0) return null;

      const item = items[0];
      const lon = parseFloat(item.lon);
      const lat = parseFloat(item.lat);

      // Nominatim boundingbox format: [southLat, northLat, westLon, eastLon]
      let bbox: [number, number, number, number] = [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02];
      if (Array.isArray(item.boundingbox) && item.boundingbox.length >= 4) {
        const southLat = parseFloat(item.boundingbox[0]);
        const northLat = parseFloat(item.boundingbox[1]);
        const westLon = parseFloat(item.boundingbox[2]);
        const eastLon = parseFloat(item.boundingbox[3]);
        bbox = [westLon, southLat, eastLon, northLat];
      }

      const boundaryRadiusKm = Math.max(
        1.5,
        haversineDistKm(bbox[0], bbox[1], bbox[2], bbox[3]) / 2.0
      );

      return {
        region_name: region,
        city: cleanCity || "India",
        display_name: item.display_name || `${region}, ${cleanCity || ""}`,
        centroid: [lon, lat],
        bounding_box: bbox,
        boundary_radius_km: Number(boundaryRadiusKm.toFixed(2)),
        geojson_geometry: item.geojson || undefined,
        source: "verified_osm",
        confidence: 0.95,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches official bounding box and centroid from Mapbox Places Geocoding API.
   */
  private async fetchFromMapbox(region: string, city?: string | null): Promise<RegionBoundary | null> {
    try {
      const cleanCity = city?.trim();
      const qualified = cleanCity && !region.toLowerCase().includes(cleanCity.toLowerCase())
        ? `${region}, ${cleanCity}`
        : region;

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(qualified)}.json`;
      const response = await axios.get(url, {
        params: {
          access_token: config.MAPBOX_ACCESS_TOKEN,
          country: "in",
          limit: 1,
          types: "neighborhood,locality,place,poi",
        },
        timeout: 10000,
      });

      const features = response.data?.features;
      if (!Array.isArray(features) || features.length === 0) return null;

      const feat = features[0];
      const center: [number, number] = [parseFloat(feat.center[0]), parseFloat(feat.center[1])];

      let bbox: [number, number, number, number];
      if (Array.isArray(feat.bbox) && feat.bbox.length >= 4) {
        bbox = [
          parseFloat(feat.bbox[0]),
          parseFloat(feat.bbox[1]),
          parseFloat(feat.bbox[2]),
          parseFloat(feat.bbox[3]),
        ];
      } else {
        bbox = [center[0] - 0.02, center[1] - 0.02, center[0] + 0.02, center[1] + 0.02];
      }

      const boundaryRadiusKm = Math.max(
        1.5,
        haversineDistKm(bbox[0], bbox[1], bbox[2], bbox[3]) / 2.0
      );

      return {
        region_name: region,
        city: city || "India",
        display_name: feat.place_name || `${region}, ${city || ""}`,
        centroid: center,
        bounding_box: bbox,
        boundary_radius_km: Number(boundaryRadiusKm.toFixed(2)),
        source: "verified_mapbox",
        confidence: 0.96,
      };
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a property location falls strictly inside or near the verified region boundary.
   * @param propertyCoords [lon, lat] of the property listing
   * @param boundary The verified region boundary
   * @param bufferToleranceKm Allowed outer tolerance buffer in kilometers (default: 0.8 km)
   */
  isInsideBoundary(
    propertyCoords: [number, number],
    boundary: RegionBoundary,
    bufferToleranceKm: number = 0.8
  ): {
    isInside: boolean;
    distanceFromCentroidKm: number;
    withinBBox: boolean;
  } {
    const [lon, lat] = propertyCoords;
    const [minLon, minLat, maxLon, maxLat] = boundary.bounding_box;

    // Convert tolerance into approx degrees (~0.009 deg per km)
    const degBuffer = bufferToleranceKm * 0.009;
    const withinBBox =
      lon >= minLon - degBuffer &&
      lon <= maxLon + degBuffer &&
      lat >= minLat - degBuffer &&
      lat <= maxLat + degBuffer;

    const distanceFromCentroidKm = haversineDistKm(
      boundary.centroid[0],
      boundary.centroid[1],
      lon,
      lat
    );

    const isInside =
      withinBBox || distanceFromCentroidKm <= boundary.boundary_radius_km + bufferToleranceKm;

    return {
      isInside,
      distanceFromCentroidKm: Number(distanceFromCentroidKm.toFixed(2)),
      withinBBox,
    };
  }
}

export const regionBoundaryService = new RegionBoundaryService();
