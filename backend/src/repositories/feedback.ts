import { Db } from "mongodb";
import { MongoRepository } from "./base.js";

export class NegotiatedRentRepository extends MongoRepository {
  public static readonly COLLECTION_NAME = "negotiated_rents";

  constructor(db: Db) {
    super(db.collection(NegotiatedRentRepository.COLLECTION_NAME));
  }

  async averageForProperty(propertyId: string): Promise<number | null> {
    const docs = await this.collection.find({ property_id: propertyId } as any).limit(100).toArray();
    if (docs.length === 0) {
      return null;
    }
    const sum = docs.reduce((acc, doc: any) => acc + (doc.negotiated_rent || 0), 0);
    return Math.round(sum / docs.length);
  }

  async averageForLocality(localityId: string): Promise<number | null> {
    const docs = await this.collection.find({ locality_id: localityId } as any).limit(500).toArray();
    if (docs.length === 0) {
      return null;
    }
    const sum = docs.reduce((acc, doc: any) => acc + (doc.negotiated_rent || 0), 0);
    return Math.round(sum / docs.length);
  }
}
