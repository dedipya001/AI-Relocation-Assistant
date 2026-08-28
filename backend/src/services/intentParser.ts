import { config } from "../core/config.js";
import { SearchIntent } from "../models/ai.js";
import { PropertySearchFilters } from "../models/property.js";

const PROPERTY_KEYWORDS: Record<string, string> = {
  pg: "PG",
  hostel: "hostel",
  "co-living": "co-living",
  coliving: "co-living",
  shared: "shared flat",
  flat: "apartment",
  apartment: "apartment",
};

const PREFERENCE_KEYWORDS: Record<string, string> = {
  peaceful: "peaceful",
  safe: "safety",
  female: "women safety",
  night: "late-night commute",
  internet: "internet reliability",
  food: "food access",
  traffic: "low traffic",
  metro: "metro connectivity",
};

export class IntentParser {
  async parse(query: string): Promise<SearchIntent> {
    const normalized = query.toLowerCase();
    const budget = this.extractBudget(normalized);

    const propertyTypes: string[] = [];
    for (const [kw, label] of Object.entries(PROPERTY_KEYWORDS)) {
      if (normalized.includes(kw)) {
        propertyTypes.push(label);
      }
    }

    const preferences: string[] = [];
    for (const [kw, label] of Object.entries(PREFERENCE_KEYWORDS)) {
      if (normalized.includes(kw)) {
        preferences.push(label);
      }
    }

    const availableModes = ["metro", "bus", "walking", "rapido", "uber", "ola"];
    const transportModes = availableModes.filter((mode) => normalized.includes(mode));

    const officeLocation = this.extractOfficeLocation(query) || config.DEFAULT_OFFICE_HINT;

    const filters: PropertySearchFilters = {
      office_location: officeLocation,
      budget_max: budget,
      property_types: Array.from(new Set(propertyTypes)),
      locality_ids: [],
      amenities: [],
      transport_modes: transportModes,
      preferences: Array.from(new Set(preferences)),
    };

    const followUps: string[] = [];
    if (!budget) {
      followUps.push("What monthly rent budget should I optimize around?");
    }
    if (transportModes.length === 0 && normalized.includes("commute")) {
      followUps.push("Which commute modes are acceptable for you?");
    }

    return {
      query,
      filters,
      inferred_lifestyle: preferences,
      follow_up_questions: followUps,
    };
  }

  private extractBudget(query: string): number | null {
    const match = query.match(/(?:under|below|budget is|budget|upto|up to)\s*(\d+)\s*k?/i);
    if (!match || !match[1]) {
      return null;
    }
    const amount = parseInt(match[1], 10);
    return amount < 1000 ? amount * 1000 : amount;
  }

  private extractOfficeLocation(query: string): string | null {
    const match = query.match(
      /(?:work in|office in|near)\s+([A-Za-z0-9 ,.-]+?)(?:,| under| with| budget| for | so that | because |$)/i
    );
    return match && match[1] ? match[1].trim() : null;
  }
}
