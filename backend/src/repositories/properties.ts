import { Db, Filter } from "mongodb";
import { PropertySearchFilters } from "../models/property.js";
import { MongoRepository, serializeDoc } from "./base.js";

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

export class PropertyRepository extends MongoRepository {
  protected db: Db;
  public static readonly COLLECTION_NAME = "properties";

  constructor(db: Db) {
    super(db.collection(PropertyRepository.COLLECTION_NAME));
    this.db = db;
  }

  async search(
    filters: PropertySearchFilters,
    limit: number = 40,
    targetCoordinates?: [number, number] | null,
    verifiedLocation?: import("../services/localityResolutionService.js").VerifiedLocationObject | null
  ): Promise<any[]> {
    const query: Filter<any> = {
      is_active: { $ne: false },
    };

    if (filters.budget_max) {
      query.rent = { $lte: filters.budget_max };
    }
    if (filters.property_types && filters.property_types.length > 0) {
      const expandedTypes = new Set<string>();
      for (const t of filters.property_types) {
        expandedTypes.add(t);
        const lower = t.toLowerCase();
        if (lower === "pg" || lower === "paying guest" || lower === "co-living" || lower === "hostel" || lower === "shared") {
          expandedTypes.add("PG");
          expandedTypes.add("pg");
          expandedTypes.add("co-living");
          expandedTypes.add("paying guest");
          expandedTypes.add("hostel");
          expandedTypes.add("shared flat");
        }
      }
      query.property_type = { $in: Array.from(expandedTypes) };
    }
    if (filters.locality_ids && filters.locality_ids.length > 0) {
      query.locality_id = { $in: filters.locality_ids };
    }

    let targetCollection = this.collection;

    if (filters.city) {
      const cleanCity = filters.city.toLowerCase().trim();
      const citySlug = cleanCity === "bengaluru" ? "bangalore" : cleanCity;
      const partitionName = `properties_${citySlug}`;

      const collections = await this.db.listCollections({ name: partitionName }).toArray();
      if (collections.length > 0) {
        targetCollection = this.db.collection(partitionName);
      } else {
        query.city = { $regex: new RegExp(filters.city, "i") };
      }
    }

    // Fetch candidate listings to perform precise geospatial & relocation ranking
    const fetchLimit = (targetCoordinates || verifiedLocation) ? 400 : limit;
    let rawDocs = await targetCollection
      .find(query)
      .sort({ rent: 1 })
      .limit(fetchLimit)
      .toArray();

    // Fallback 1: If budget was too strict (0 results), relax budget constraint
    if (rawDocs.length === 0 && query.rent) {
      const relaxedQuery = { ...query };
      delete relaxedQuery.rent;
      rawDocs = await targetCollection
        .find(relaxedQuery)
        .sort({ rent: 1 })
        .limit(fetchLimit)
        .toArray();
    }

    // Fallback 2: If still 0 results, fetch all active properties from target collection or unified collection
    if (rawDocs.length === 0) {
      rawDocs = await targetCollection
        .find({ is_active: { $ne: false } })
        .sort({ rent: 1 })
        .limit(fetchLimit)
        .toArray();
    }

    if (rawDocs.length === 0 && targetCollection !== this.collection) {
      rawDocs = await this.collection
        .find({ is_active: { $ne: false } })
        .sort({ rent: 1 })
        .limit(fetchLimit)
        .toArray();
    }

    let docs = rawDocs.map(serializeDoc);

    const refCoordinates = verifiedLocation
      ? [verifiedLocation.longitude, verifiedLocation.latitude] as [number, number]
      : targetCoordinates;

    // If target coordinates or verified location are provided, compute exact distance and classify exact vs nearby
    if (refCoordinates && refCoordinates.length === 2) {
      const [tLon, tLat] = refCoordinates;
      const STOP_WORDS = new Set(["lane", "road", "street", "near", "flat", "flats", "house", "apartment", "city", "west", "east", "north", "south", "gate", "block", "floor", "area", "bhk", "rent", "pg"]);
      const searchTerms = (filters.office_location || "")
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

      for (const item of docs) {
        // ALWAYS preserve real property locality name
        item.actual_locality_name = item.locality || "Locality";

        let coords = item.location?.coordinates;

        // Precise coordinate calibration if listing has broad city center or missing coords
        if (verifiedLocation && (!coords || (Array.isArray(coords) && Math.abs(coords[0] - 88.3638) < 0.01 && Math.abs(coords[1] - 22.5726) < 0.01))) {
          const titleOrLoc = `${item.title || ""} ${item.locality || ""}`.toLowerCase();
          if (titleOrLoc.includes(verifiedLocation.canonicalName.toLowerCase()) || titleOrLoc.includes(verifiedLocation.searchedName.toLowerCase())) {
            // Calibrate to verified locality centroid with deterministic micro-offset
            const hash = Array.from(String(item._id || item.title)).reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const offLon = ((hash % 100) - 50) * 0.00015;
            const offLat = (((hash * 7) % 100) - 50) * 0.00015;
            coords = [
              Number((verifiedLocation.longitude + offLon).toFixed(6)),
              Number((verifiedLocation.latitude + offLat).toFixed(6)),
            ];
            item.location = { type: "Point", coordinates: coords };
          }
        }

        if (Array.isArray(coords) && coords.length >= 2) {
          const pLon = Number(coords[0]);
          const pLat = Number(coords[1]);
          const dist = haversineDistKm(tLon, tLat, pLon, pLat);
          item.distance_to_office_km = Number(dist.toFixed(2));
          item.commute_estimate_minutes = Math.max(5, Math.floor(dist * 4 + 6));

          if (verifiedLocation) {
            const [bMinX, bMinY, bMaxX, bMaxY] = verifiedLocation.bounding_box || [
              tLon - 0.02,
              tLat - 0.02,
              tLon + 0.02,
              tLat + 0.02,
            ];
            const withinBBox =
              pLon >= bMinX - 0.006 &&
              pLon <= bMaxX + 0.006 &&
              pLat >= bMinY - 0.006 &&
              pLat <= bMaxY + 0.006;
            const distFromCentroid = haversineDistKm(
              verifiedLocation.longitude,
              verifiedLocation.latitude,
              pLon,
              pLat
            );
            const isExact =
              withinBBox || distFromCentroid <= (verifiedLocation.boundary_radius_km || 2.0) + 0.5;
            const isNearby = !isExact && distFromCentroid <= 6.0;

            item.is_exact_locality_match = isExact;
            item.is_within_verified_boundary = isExact;
            item.is_nearby_match = isNearby;
            item._boundary_boost = isExact ? 100 : (isNearby ? 40 : 0);

            if (isExact) {
              item.locality_display_label = item.locality;
              item.proximity_label = `Located in ${item.locality}`;
            } else if (isNearby) {
              item.locality_display_label = `${item.locality} (near ${verifiedLocation.canonicalName})`;
              item.proximity_label = `Located in ${item.locality}, near ${verifiedLocation.canonicalName} (${dist.toFixed(1)} km away)`;
            } else {
              item.locality_display_label = item.locality;
              item.proximity_label = `Outside search area (${dist.toFixed(1)} km away)`;
            }
          }
        } else {
          item.distance_to_office_km = 999.0;
          item.is_exact_locality_match = false;
          item.is_within_verified_boundary = false;
          item.is_nearby_match = false;
          item._boundary_boost = 0;
          item.locality_display_label = item.locality;
        }

        // Boost exact whole-word locality matches only if property is reasonably close (< 15km)
        const locName = (item.locality || "").toLowerCase();
        let keywordMatchScore = 0;
        if ((item.distance_to_office_km || 999.0) <= 15.0) {
          for (const term of searchTerms) {
            const regex = new RegExp(`\\b${term}\\b`, "i");
            if (regex.test(locName)) keywordMatchScore += 20;
          }
        }
        item._keyword_boost = keywordMatchScore;
      }

      // Filter out properties that are completely unrelated/far (> 7.0km) when a verified locality is searched
      if (verifiedLocation) {
        const filteredDocs = docs.filter(
          (d) => d.is_exact_locality_match || d.is_nearby_match || (d.distance_to_office_km || 999.0) <= 6.0
        );
        if (filteredDocs.length > 0) {
          docs = filteredDocs;
        }
      }

      // Sort: exact matches first, then nearby matches, then proximity, then rent
      docs.sort((a, b) => {
        const boundA = a._boundary_boost || 0;
        const boundB = b._boundary_boost || 0;
        if (boundA !== boundB) return boundB - boundA;

        const distA = a.distance_to_office_km || 999.0;
        const distB = b.distance_to_office_km || 999.0;

        if (Math.abs(distA - distB) <= 1.5 && (b._keyword_boost || 0) !== (a._keyword_boost || 0)) {
          return (b._keyword_boost || 0) - (a._keyword_boost || 0);
        }

        if (Math.abs(distA - distB) > 0.3) return distA - distB;
        return (a.rent || 0) - (b.rent || 0);
      });
    }

    return docs.slice(0, limit);
  }

  async upsertByDedupeKey(payload: Record<string, any>): Promise<any> {
    const now = new Date();
    const { created_at, ...updateFields } = payload;

    await this.collection.updateOne(
      { dedupe_key: payload.dedupe_key },
      {
        $set: updateFields,
        $setOnInsert: { created_at: created_at || now },
      },
      { upsert: true }
    );

    const doc = await this.collection.findOne({ dedupe_key: payload.dedupe_key });
    return serializeDoc(doc) || payload;
  }
}
