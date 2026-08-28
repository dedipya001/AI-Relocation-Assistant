import { MongoClient, Db } from "mongodb";
import { config } from "../core/config.js";
import { logger } from "../core/logger.js";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) {
    return database;
  }

  try {
    client = new MongoClient(config.MONGODB_URI);
    await client.connect();
    database = client.db(config.MONGODB_DB);
    await ensureIndexes(database);
    logger.info({ db: config.MONGODB_DB }, "mongodb_connected");
    return database;
  } catch (error) {
    logger.error({ error }, "mongodb_connection_failed");
    throw error;
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
    logger.info("mongodb_closed");
  }
}

export function getDatabase(): Db {
  if (!database) {
    throw new Error("MongoDB has not been initialized. Call connectMongo() first.");
  }
  return database;
}

export async function ensureIndexes(db: Db): Promise<void> {
  try {
    await db.collection("properties").createIndex({ location: "2dsphere" });
    await db.collection("properties").createIndex({ dedupe_key: 1 }, { unique: true });
    await db.collection("properties").createIndex({ locality_id: 1, rent: 1 });

    await db.collection("localities").createIndex({ location: "2dsphere" });
    await db.collection("localities").createIndex({ slug: 1 }, { unique: true });

    await db.collection("negotiated_rents").createIndex({ property_id: 1, created_at: -1 });
    await db.collection("reviews").createIndex({ locality_id: 1, source: 1 });
    await db.collection("ai_summaries").createIndex({ entity_type: 1, entity_id: 1 }, { unique: true });
  } catch (error) {
    logger.warn({ error }, "ensure_indexes_warning");
  }
}
