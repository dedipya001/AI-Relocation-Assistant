import { PropertyBase } from "../../models/property.js";

export interface ScrapeContext {
  city: string;
  query: string;
  max_pages?: number;
}

export interface PropertySourceAdapter {
  sourceName: string;
  fetch(context: ScrapeContext): Promise<PropertyBase[]>;
}
