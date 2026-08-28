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
    const query: Filter<any> = {};

    if (filters.budget_max) {
      query.rent = { $lte: filters.budget_max };
    }
    if (filters.property_types && filters.property_types.length > 0) {
      query.property_type = { $in: filters.property_types };
    }
    if (filters.locality_ids && filters.locality_ids.length > 0) {
      query.locality_id = { $in: filters.locality_ids };
    }
    if (filters.amenities && filters.amenities.length > 0) {
      query.amenities = { $all: filters.amenities };
    }

    const collections = await this.getPropertyCollections();
    const perCollectionLimit = Math.max(limit, 100);
    const docs: any[] = [];

    for (const coll of collections) {
      const results = await coll
        .find(query)
        .sort({ rent: 1 })
        .limit(perCollectionLimit)
        .toArray();
      docs.push(...results);
    }

    docs.sort((a, b) => (a.rent || 0) - (b.rent || 0));
    return docs.slice(0, limit).map(serializeDoc);
  }

  async getPropertyCollections(): Promise<any[]> {
    const collections = await this.db.listCollections().toArray();
    const propertyCollectionNames = collections
      .map((c) => c.name)
      .filter((name) => name === PropertyRepository.COLLECTION_NAME || name.startsWith("properties_"))
      .sort();

    if (propertyCollectionNames.length === 0) {
      return [this.collection];
    }
    return propertyCollectionNames.map((name) => this.db.collection(name));
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
