import { config } from "../core/config.js";
import { SearchIntent } from "../models/ai.js";
import { PropertySearchFilters } from "../models/property.js";
import { AIAdvisor } from "./aiAdvisor.js";

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
  private advisor = new AIAdvisor();

  async parse(query: string): Promise<SearchIntent> {
    const normalized = query.toLowerCase();

    // 1. Try high-precision LLM extraction if OpenAI is enabled
    if (config.OPENAI_API_KEY) {
      const llmResult = await this.advisor.parseIntentWithLLM(query);
      if (llmResult && llmResult.filters) {
        return {
          query,
          filters: {
            city: llmResult.filters.city || undefined,
            office_location: llmResult.filters.office_location || this.extractOfficeLocation(query) || config.DEFAULT_OFFICE_HINT,
            budget_max: llmResult.filters.budget_max || this.extractBudget(normalized),
            property_types: llmResult.filters.property_types || [],
            locality_ids: [],
            amenities: llmResult.filters.amenities || [],
            transport_modes: [],
            preferences: llmResult.filters.preferences || [],
          },
          inferred_lifestyle: llmResult.inferred_lifestyle || [],
          follow_up_questions: [],
        };
      }
    }

    // 2. Deterministic heuristic fallback
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
    // 1. Direct office / near / workplace patterns
    const workMatch = query.match(
      /(?:work in|office in|office is|office at|near|around|close to|nearby)\s+([A-Za-z0-9 ,.-]+?)(?:,| under| with| budget| for | so that | because |$)/i
    );
    if (workMatch && workMatch[1]?.trim()) {
      return workMatch[1].trim();
    }

    // 2. Direct locality search patterns: "flat in...", "in tarulia lane", "around balewadi"
    const locMatch = query.match(
      /(?:flat in|flats in|apartment in|pg in|house in|room in|place in|in|at)\s+([A-Za-z0-9 ,.-]+?)(?:,| under| with| budget| for | so that | because |$)/i
    );
    if (locMatch && locMatch[1]?.trim()) {
      const cleaned = locMatch[1].trim();
      const genericCities = ["kolkata", "bangalore", "bengaluru", "pune", "mumbai", "delhi", "hyderabad", "chennai"];
      if (!genericCities.includes(cleaned.toLowerCase())) {
        return cleaned;
      }
    }

    return null;
  }
}
