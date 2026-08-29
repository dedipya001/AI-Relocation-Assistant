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
    targetCoordinates?: [number, number] | null
  ): Promise<any[]> {
    const query: Filter<any> = {
      is_active: { $ne: false },
    };

    if (filters.budget_max) {
      query.rent = { $lte: filters.budget_max };
    }
    if (filters.property_types && filters.property_types.length > 0) {
      query.property_type = { $in: filters.property_types };
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

    // Fetch up to 400 candidate listings to perform precise geospatial & relocation ranking
    const fetchLimit = targetCoordinates ? 400 : limit;
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

    // If target coordinates are provided, compute exact distance and sort proximity-first
    if (targetCoordinates && targetCoordinates.length === 2) {
      const [tLon, tLat] = targetCoordinates;
      const STOP_WORDS = new Set(["lane", "road", "street", "near", "flat", "flats", "house", "apartment", "city", "west", "east", "north", "south", "gate", "block", "floor", "area", "bhk", "rent"]);
      const searchTerms = (filters.office_location || "")
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

      for (const item of docs) {
        const coords = item.location?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const dist = haversineDistKm(tLon, tLat, Number(coords[0]), Number(coords[1]));
          item.distance_to_office_km = Number(dist.toFixed(2));
          item.commute_estimate_minutes = Math.max(5, Math.floor(dist * 4 + 6));
        } else {
          item.distance_to_office_km = 999.0;
        }

        // Boost exact whole-word locality matches only if property is reasonably close (< 15km)
        const locName = (item.locality || "").toLowerCase();
        let keywordMatchScore = 0;
        if ((item.distance_to_office_km || 999.0) <= 15.0) {
          for (const term of searchTerms) {
            const regex = new RegExp(`\\b${term}\\b`, "i");
            if (regex.test(locName)) keywordMatchScore += 15;
          }
        }
        item._keyword_boost = keywordMatchScore;
      }

      // Sort: closest proximity first, with keyword boost for tie-breaking/close proximity, then rent
      docs.sort((a, b) => {
        const distA = a.distance_to_office_km || 999.0;
        const distB = b.distance_to_office_km || 999.0;

        // If one is > 15km away and another is nearby, nearby always wins
        if (distA <= 15.0 && distB > 15.0) return -1;
        if (distB <= 15.0 && distA > 15.0) return 1;

        // If distances are within 2 km of each other, apply keyword boost
        if (Math.abs(distA - distB) <= 2.0 && (b._keyword_boost || 0) !== (a._keyword_boost || 0)) {
          return (b._keyword_boost || 0) - (a._keyword_boost || 0);
        }

        // Otherwise pure proximity
        if (Math.abs(distA - distB) > 0.4) return distA - distB;
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
