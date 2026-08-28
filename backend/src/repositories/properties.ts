import { Db, Filter } from "mongodb";
import { PropertySearchFilters } from "../models/property.js";
import { MongoRepository, serializeDoc } from "./base.js";

export class PropertyRepository extends MongoRepository {
  protected db: Db;
  public static readonly COLLECTION_NAME = "properties";

  constructor(db: Db) {
    super(db.collection(PropertyRepository.COLLECTION_NAME));
    this.db = db;
  }

  async search(filters: PropertySearchFilters, limit: number = 40): Promise<any[]> {
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

    let docs = await targetCollection
      .find(query)
      .sort({ rent: 1 })
      .limit(limit)
      .toArray();

    // Fallback 1: If budget was too strict (0 results), relax budget constraint
    if (docs.length === 0 && query.rent) {
      const relaxedQuery = { ...query };
      delete relaxedQuery.rent;
      docs = await targetCollection
        .find(relaxedQuery)
        .sort({ rent: 1 })
        .limit(limit)
        .toArray();
    }

    // Fallback 2: If still 0 results, fetch top active properties from target collection or unified collection
    if (docs.length === 0) {
      docs = await targetCollection
        .find({ is_active: { $ne: false } })
        .sort({ rent: 1 })
        .limit(limit)
        .toArray();
    }

    if (docs.length === 0 && targetCollection !== this.collection) {
      docs = await this.collection
        .find({ is_active: { $ne: false } })
        .sort({ rent: 1 })
        .limit(limit)
        .toArray();
    }

    return docs.map(serializeDoc);
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
