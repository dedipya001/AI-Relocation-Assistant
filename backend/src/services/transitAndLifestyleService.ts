import {
  BUS_ROUTES,
  DATASET_VERIFIED_AT,
  METRO_LINES,
  PROXIMITY_POINTS,
  BusRouteRecord,
  MetroLineRecord,
  NetworkStatus,
  ProximityPoint,
  normalizeTransitCity,
} from "../data/transitAndLifestyle.js";

export type NearbyResult = ProximityPoint & {
  distance_km: number | null;
  walking_minutes: number | null;
};

export type TransitQueryOptions = {
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  limit?: number;
};

export type LocalityTransitEnrichment = {
  dataset_verified_at: string;
  city: string;
  metro_lines: Array<Pick<MetroLineRecord, "id" | "name" | "status" | "source_url" | "source_note">>;
  nearest_metro: NearbyResult[];
  nearest_bus: NearbyResult[];
  nearby_lifestyle: NearbyResult[];
  nearby_tech_hubs: NearbyResult[];
};

function validCoordinate(lat?: number | null, lon?: number | null): lat is number {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkingMinutes(distanceKm: number) {
  const walkingSpeedKmh = 4.8;
  return Math.max(1, Math.round((distanceKm / walkingSpeedKmh) * 60));
}

function cityMatches(recordCity: string, city?: string | null) {
  if (!city) return true;
  return normalizeTransitCity(recordCity).toLowerCase() === normalizeTransitCity(city).toLowerCase();
}

function withDistance(point: ProximityPoint, options: TransitQueryOptions): NearbyResult {
  if (!validCoordinate(options.lat, options.lon)) {
    return { ...point, distance_km: null, walking_minutes: null };
  }
  const distance = haversineDistanceKm(
    options.lat,
    options.lon as number,
    point.coordinates[1],
    point.coordinates[0]
  );
  return {
    ...point,
    distance_km: Number(distance.toFixed(2)),
    walking_minutes: walkingMinutes(distance),
  };
}

function sortNearby(rows: NearbyResult[]) {
  return rows.sort((a, b) => {
    if (a.distance_km === null && b.distance_km === null) return a.name.localeCompare(b.name);
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });
}

export class TransitAndLifestyleService {
  listMetro(options: TransitQueryOptions & { status?: NetworkStatus | null } = {}): {
    dataset_verified_at: string;
    city: string | null;
    lines: MetroLineRecord[];
    nearest_stations: NearbyResult[];
  } {
    const city = options.city ? normalizeTransitCity(options.city) : null;
    const lines = METRO_LINES.filter(
      (line) => cityMatches(line.city, city) && (!options.status || line.status === options.status)
    );
    const nearestStations = this.nearbyByCategories(["metro"], { ...options, city });
    return {
      dataset_verified_at: DATASET_VERIFIED_AT,
      city,
      lines,
      nearest_stations: nearestStations,
    };
  }

  listBus(options: TransitQueryOptions = {}): {
    dataset_verified_at: string;
    city: string | null;
    routes: BusRouteRecord[];
    nearest_stops: NearbyResult[];
  } {
    const city = options.city ? normalizeTransitCity(options.city) : null;
    return {
      dataset_verified_at: DATASET_VERIFIED_AT,
      city,
      routes: BUS_ROUTES.filter((route) => cityMatches(route.city, city)),
      nearest_stops: this.nearbyByCategories(["bus"], { ...options, city }),
    };
  }

  listLifestyle(options: TransitQueryOptions = {}): {
    dataset_verified_at: string;
    city: string | null;
    places: NearbyResult[];
  } {
    const city = options.city ? normalizeTransitCity(options.city) : null;
    return {
      dataset_verified_at: DATASET_VERIFIED_AT,
      city,
      places: this.nearbyByCategories(
        ["cafe", "bakery", "coffee_roaster", "microbrewery", "club", "late_night_cafe"],
        { ...options, city }
      ),
    };
  }

  listHubs(options: TransitQueryOptions = {}): {
    dataset_verified_at: string;
    city: string | null;
    hubs: NearbyResult[];
  } {
    const city = options.city ? normalizeTransitCity(options.city) : null;
    return {
      dataset_verified_at: DATASET_VERIFIED_AT,
      city,
      hubs: this.nearbyByCategories(["tech_hub"], { ...options, city }),
    };
  }

  enrichLocality(locality: Record<string, any>): LocalityTransitEnrichment {
    const city = normalizeTransitCity(String(locality.city || ""));
    const coords = locality.location?.coordinates;
    const options: TransitQueryOptions = {
      city,
      lon: Array.isArray(coords) && coords.length >= 2 ? Number(coords[0]) : null,
      lat: Array.isArray(coords) && coords.length >= 2 ? Number(coords[1]) : null,
      limit: 5,
    };
    return {
      dataset_verified_at: DATASET_VERIFIED_AT,
      city,
      metro_lines: METRO_LINES.filter((line) => cityMatches(line.city, city)).map((line) => ({
        id: line.id,
        name: line.name,
        status: line.status,
        source_url: line.source_url,
        source_note: line.source_note,
      })),
      nearest_metro: this.nearbyByCategories(["metro"], options),
      nearest_bus: this.nearbyByCategories(["bus"], options),
      nearby_lifestyle: this.nearbyByCategories(
        ["cafe", "bakery", "coffee_roaster", "microbrewery", "club", "late_night_cafe"],
        options
      ),
      nearby_tech_hubs: this.nearbyByCategories(["tech_hub"], options),
    };
  }

  private nearbyByCategories(
    categories: ProximityPoint["category"][],
    options: TransitQueryOptions
  ): NearbyResult[] {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10));
    const rows = PROXIMITY_POINTS.filter(
      (point) => categories.includes(point.category) && cityMatches(point.city, options.city)
    ).map((point) => withDistance(point, options));
    return sortNearby(rows).slice(0, limit);
  }
}
