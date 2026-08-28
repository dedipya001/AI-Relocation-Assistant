import { PropertyBase } from "../../models/property.js";
import { PropertySourceAdapter, ScrapeContext } from "./base.js";

export class MarketplaceAdapter implements PropertySourceAdapter {
  sourceName: string;

  constructor(sourceName: string) {
    this.sourceName = sourceName;
  }

  async fetch(_context: ScrapeContext): Promise<PropertyBase[]> {
    // Production adapters should use official APIs, partner feeds, or ToS-compliant scraping.
    // This keeps the pipeline contract stable while integrations are added.
    return [];
  }
}

export const HousingAdapter = () => new MarketplaceAdapter("Housing");
export const MagicBricksAdapter = () => new MarketplaceAdapter("MagicBricks");
export const Acres99Adapter = () => new MarketplaceAdapter("99acres");
