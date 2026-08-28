import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables from single root .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const configSchema = z.object({
  ENVIRONMENT: z.string().default("local"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().default(8000),
  PORT: z.coerce.number().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  MONGODB_URI: z.string().default("mongodb://localhost:27017"),
  MONGODB_DB: z.string().default("relocation_ai"),

  REDIS_URL: z.string().default("redis://localhost:6379/0"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),

  APIFY_TOKEN: z.string().optional(),
  APIFY_MAGICBRICKS_ACTOR_ID: z.string().optional(),
  APIFY_99ACRES_ACTOR_ID: z.string().optional(),
  APIFY_NOBROKER_ACTOR_ID: z.string().optional(),

  BRIGHTDATA_API_KEY: z.string().optional(),
  BRIGHTDATA_MAGICBRICKS_DATASET_ID: z.string().optional(),
  BRIGHTDATA_99ACRES_DATASET_ID: z.string().optional(),
  BRIGHTDATA_NOBROKER_DATASET_ID: z.string().optional(),

  BROKER_CRM_FEED_URL: z.string().optional(),
  RERA_FEED_URL: z.string().optional(),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
  SCRAPER_USER_AGENT: z.string().default("RelocationAIResearchBot/0.1"),
  SCRAPER_PROXY_URL: z.string().optional(),

  DEFAULT_CITY: z.string().default("Kolkata"),
  DEFAULT_OFFICE_HINT: z.string().default("Sector V, Salt Lake, Kolkata"),
});

const rawConfig = configSchema.parse(process.env);

export const config = {
  ...rawConfig,
  port: rawConfig.PORT ?? rawConfig.API_PORT,
  corsOrigins: rawConfig.FRONTEND_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  cachePrefix: `relocation:${rawConfig.ENVIRONMENT}`,
};

export type Config = typeof config;
