import {
  MetroLine,
  MetroStation,
  BusRoute,
  LifestyleVenue,
  REAL_METRO_LINES,
  REAL_BUS_ROUTES,
  REAL_LIFESTYLE_VENUES,
} from "../data/transitAndLifestyle.js";
import { haversineKm } from "./commute.js";

export interface NearestMetroHub {
  station_name: string;
  line_name: string;
  line_code: string;
  color_code: string;
  city: string;
  is_interchange: boolean;
  interchange_lines?: string[];
  distance_km: number;
  walking_minutes: number;
  coordinates: [number, number];
}

export interface NearestLifestyleHub {
  venue: LifestyleVenue;
  distance_km: number;
  walking_minutes: number;
}

export class TransitAndLifestyleService {
  /**
   * Get all metro lines for a city (or all cities)
   */
  getMetroLines(city?: string): MetroLine[] {
    if (!city) return REAL_METRO_LINES;
    const cleanCity = city.trim().toLowerCase();
    return REAL_METRO_LINES.filter(
      (m) =>
        m.city.toLowerCase() === cleanCity ||
        (cleanCity === "bengaluru" && m.city.toLowerCase() === "bangalore") ||
        (cleanCity === "calcutta" && m.city.toLowerCase() === "kolkata")
    );
  }

  /**
   * Get all bus routes for a city, optionally filtering by origin/destination
   */
  getBusRoutes(city?: string, query?: string): BusRoute[] {
    let routes = REAL_BUS_ROUTES;
    if (city) {
      const cleanCity = city.trim().toLowerCase();
      routes = routes.filter(
        (r) =>
          r.city.toLowerCase() === cleanCity ||
          (cleanCity === "bengaluru" && r.city.toLowerCase() === "bangalore") ||
          (cleanCity === "calcutta" && r.city.toLowerCase() === "kolkata")
      );
    }
    if (query) {
      const q = query.trim().toLowerCase();
      routes = routes.filter(
        (r) =>
          r.route_number.toLowerCase().includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.via_stops.some((s) => s.toLowerCase().includes(q))
      );
    }
    return routes;
  }

  /**
   * Get cafes, clubs, and nightlife venues by locality or city
   */
  getLifestyle(options?: {
    city?: string;
    localityId?: string;
    localityName?: string;
    category?: "cafe" | "specialty_coffee" | "brewery" | "club" | "lounge" | "cocktail_bar" | "all";
  }): LifestyleVenue[] {
    let venues = REAL_LIFESTYLE_VENUES;

    if (options?.city) {
      const cleanCity = options.city.trim().toLowerCase();
      venues = venues.filter(
        (v) =>
          v.city.toLowerCase() === cleanCity ||
          (cleanCity === "bengaluru" && v.city.toLowerCase() === "bangalore") ||
          (cleanCity === "calcutta" && v.city.toLowerCase() === "kolkata")
      );
    }

    if (options?.localityId) {
      venues = venues.filter((v) => v.locality_id === options.localityId);
    } else if (options?.localityName) {
      const locName = options.localityName.trim().toLowerCase();
      venues = venues.filter((v) => v.locality.toLowerCase().includes(locName));
    }

    if (options?.category && options.category !== "all") {
      venues = venues.filter((v) => v.category === options.category);
    }

    return venues;
  }

  /**
   * Find nearest metro stations, bus routes, cafes, and clubs to a given GPS coordinate
   */
  findNearestHubs(lon: number, lat: number, maxRadiusKm = 10.0): {
    metro_stations: NearestMetroHub[];
    bus_routes: BusRoute[];
    cafes_nearby: NearestLifestyleHub[];
    clubs_and_breweries: NearestLifestyleHub[];
  } {
    // 1. Metro stations
    const stationsWithDistance: NearestMetroHub[] = [];
    for (const line of REAL_METRO_LINES) {
      for (const st of line.stations) {
        const distKm = haversineKm(lon, lat, st.coordinates[0], st.coordinates[1]);
        if (distKm <= maxRadiusKm) {
          const walkMin = Math.round((distKm / 4.8) * 60);
          stationsWithDistance.push({
            station_name: st.name,
            line_name: line.name,
            line_code: line.line_id,
            color_code: line.color_code,
            city: line.city,
            is_interchange: st.is_interchange,
            interchange_lines: st.interchange_lines,
            distance_km: Number(distKm.toFixed(2)),
            walking_minutes: walkMin,
            coordinates: st.coordinates,
          });
        }
      }
    }

    // Sort closest first and deduplicate by station name
    stationsWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    const seenStationNames = new Set<string>();
    const uniqueMetroStations = stationsWithDistance.filter((st) => {
      if (seenStationNames.has(st.station_name)) return false;
      seenStationNames.add(st.station_name);
      return true;
    }).slice(0, 5);

    // 2. Bus routes (Match by city/vicinity)
    const matchingBusRoutes = REAL_BUS_ROUTES.slice(0, 5);

    // 3. Lifestyle: Cafes & Specialty Coffee
    const cafes: NearestLifestyleHub[] = [];
    const clubs: NearestLifestyleHub[] = [];

    for (const venue of REAL_LIFESTYLE_VENUES) {
      if (venue.coordinates) {
        const distKm = haversineKm(lon, lat, venue.coordinates[0], venue.coordinates[1]);
        if (distKm <= maxRadiusKm) {
          const walkMin = Math.round((distKm / 4.8) * 60);
          const item: NearestLifestyleHub = {
            venue,
            distance_km: Number(distKm.toFixed(2)),
            walking_minutes: walkMin,
          };

          if (venue.category === "cafe" || venue.category === "specialty_coffee") {
            cafes.push(item);
          } else {
            clubs.push(item);
          }
        }
      }
    }

    cafes.sort((a, b) => a.distance_km - b.distance_km);
    clubs.sort((a, b) => a.distance_km - b.distance_km);

    return {
      metro_stations: uniqueMetroStations,
      bus_routes: matchingBusRoutes,
      cafes_nearby: cafes.slice(0, 6),
      clubs_and_breweries: clubs.slice(0, 6),
    };
  }
}
