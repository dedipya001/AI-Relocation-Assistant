import { existsSync } from "fs";
import { spawnSync } from "child_process";
import { MongoClient } from "mongodb";
import { config } from "../src/core/config.js";

async function main() {
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  const db = client.db(config.MONGODB_DB);
  const count = await db.collection("localities").estimatedDocumentCount();
  await client.close();

  if (count > 0) {
    console.log(`Database already contains ${count} localities; skipping seed.`);
    return;
  }

  console.log("Database is empty; running initial seed...");
  const compiledSeed = "dist/scripts/seed.js";
  const command = existsSync(compiledSeed)
    ? { bin: "node", args: [compiledSeed] }
    : { bin: "npx", args: ["tsx", "scripts/seed.ts"] };

  const result = spawnSync(command.bin, command.args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error("Initial seed check failed:", error);
  process.exit(1);
});
