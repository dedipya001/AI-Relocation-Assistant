import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";
import { TransitAndLifestyleService } from "../src/services/transitAndLifestyleService.js";

async function run() {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(config.MONGODB_DB);
    const collection = db.collection("localities");
    const localities = await collection.find({}).toArray();
    const service = new TransitAndLifestyleService();

    for (const locality of localities) {
      const transitLifestyle = service.enrichLocality(locality);
      await collection.updateOne(
        { _id: locality._id },
        {
          $set: {
            transit_lifestyle: transitLifestyle,
            updated_at: new Date().toISOString(),
          },
        }
      );
    }

    console.log(`Enriched ${localities.length} locality documents with verified transit/lifestyle context.`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("Transit/lifestyle locality enrichment failed", error);
  process.exit(1);
});
