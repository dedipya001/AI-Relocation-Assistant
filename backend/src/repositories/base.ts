import { Collection, Document, Filter, ObjectId, OptionalUnlessRequiredId } from "mongodb";

export function toObjectId(id: string): ObjectId | string {
  try {
    if (ObjectId.isValid(id) && new ObjectId(id).toString() === id) {
      return new ObjectId(id);
    }
  } catch {
    // fallback to string id
  }
  return id;
}

export function serializeDoc<T extends Document>(doc: T | null): any {
  if (!doc) return null;
  const result: any = { ...doc };
  if (result._id) {
    result._id = result._id.toString();
  }
  return result;
}

export class MongoRepository<T extends Document = Document> {
  protected collection: Collection<T>;

  constructor(collection: Collection<T>) {
    this.collection = collection;
  }

  async get(itemId: string): Promise<any | null> {
    const objectId = toObjectId(itemId);
    const doc = await this.collection.findOne({
      $or: [{ _id: objectId as any }, { _id: itemId as any }],
    } as Filter<T>);
    return serializeDoc(doc);
  }

  async list(query: Filter<T> = {}, limit: number = 20): Promise<any[]> {
    const docs = await this.collection.find(query).limit(limit).toArray();
    return docs.map(serializeDoc);
  }

  async create(payload: OptionalUnlessRequiredId<T>): Promise<any> {
    const result = await this.collection.insertOne(payload);
    return serializeDoc({
      ...payload,
      _id: result.insertedId,
    } as T);
  }
}
