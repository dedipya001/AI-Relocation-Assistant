import crypto from "crypto";
import { logger } from "../core/logger.js";
import { PropertyBase } from "../models/property.js";
import { PropertyRepository } from "../repositories/properties.js";
import { PropertySourceAdapter, ScrapeContext } from "./sources/base.js";

export class ScrapingPipeline {
  private repository: PropertyRepository;
  private adapters: PropertySourceAdapter[];

  constructor(repository: PropertyRepository, adapters: PropertySourceAdapter[]) {
    this.repository = repository;
    this.adapters = adapters;
  }

  async run(context: ScrapeContext): Promise<{ processed: number }> {
    let inserted = 0;
    for (const adapter of this.adapters) {
      try {
        const listings = await this.fetchWithRetry(adapter, context);
        for (const listing of listings) {
          const normalized = this.normalize(listing);
          await this.repository.upsertByDedupeKey(normalized);
          inserted += 1;
        }
        logger.info(
          { source: adapter.sourceName, count: listings.length },
          "scrape_source_completed"
        );
      } catch (error) {
        logger.error(
          { source: adapter.sourceName, error: (error as Error).message },
          "scrape_source_failed"
        );
      }
    }
    return { processed: inserted };
  }

  private async fetchWithRetry(
    adapter: PropertySourceAdapter,
    context: ScrapeContext,
    maxRetries: number = 3
  ): Promise<PropertyBase[]> {
    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        return await adapter.fetch(context);
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    return [];
  }

  private normalize(listing: PropertyBase): Record<string, any> {
    if (listing.dedupe_key) {
      return { ...listing };
    }
    const coords = listing.location?.coordinates || [0, 0];
    const key = crypto
      .createHash("sha256")
      .update(`${listing.title}:${listing.rent}:${coords[0]},${coords[1]}`)
      .digest("hex");

    return {
      ...listing,
      dedupe_key: key,
    };
  }
}
