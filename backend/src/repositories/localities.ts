import { Db } from "mongodb";
import { MongoRepository, serializeDoc } from "./base.js";

export class LocalityRepository extends MongoRepository {
  public static readonly COLLECTION_NAME = "localities";

  constructor(db: Db) {
    super(db.collection(LocalityRepository.COLLECTION_NAME));
  }

  async findBySlugs(slugs: string[]): Promise<any[]> {
    if (!slugs || slugs.length === 0) {
      return [];
    }
    const docs = await this.collection.find({ slug: { $in: slugs } } as any).toArray();
    return docs.map(serializeDoc);
  }

  async topForCity(city: string, limit: number = 12): Promise<any[]> {
    const docs = await this.collection
      .find({ city } as any)
      .sort({ "scores.overall": -1 })
      .limit(limit)
      .toArray();
    return docs.map(serializeDoc);
  }
}
