import OpenAI from "openai";
import { config } from "../core/config.js";
import { SearchIntent } from "../models/ai.js";
import { Property } from "../models/property.js";
import { WebSearchService } from "./webSearch.js";

export class AIAdvisor {
  private openai: OpenAI | null = null;
  private searchService: WebSearchService;

  constructor() {
    this.searchService = new WebSearchService();
    if (config.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generates conversational relocation advice grounded in real-world web search signals,
   * locality realities, and verified property candidates.
   */
  async generateAdvice(params: {
    message: string;
    intent: SearchIntent;
    properties: any[];
    localitiesById?: Record<string, any>;
    officeCoordinates?: [number, number] | null;
  }): Promise<{ answer: string; realWorldInsights: string[] }> {
    const { message, intent, properties, localitiesById = {} } = params;
    const topProperties = properties.slice(0, 4);

    const primaryLocality =
      topProperties[0]?.locality || intent.filters.office_location || config.DEFAULT_CITY;
    const primaryCity = topProperties[0]?.city || config.DEFAULT_CITY;

    // 1. Fetch live web / ground truth signals
    const searchSignals = await this.searchService.searchLocalitySignals(
      message,
      primaryLocality,
      primaryCity
    );

    const insightSnippets = searchSignals.map((s) => `${s.title}: ${s.snippet}`);

    // If OpenAI API key is not configured, return an intelligent templated response
    if (!this.openai) {
      const topTitles = topProperties.map((p) => `${p.title} (₹${p.rent.toLocaleString("en-IN")}/mo)`).join(", ");
      return {
        answer: topProperties.length > 0
          ? `Based on your requirements near ${intent.filters.office_location || primaryLocality}, I recommend exploring ${topProperties[0].locality || "the area"}. Top verified matches: ${topTitles}. Real-world insight: ${insightSnippets[0] || "Area offers great broadband and food access."}`
          : `I analyzed your search for "${message}". Please provide your target office area and preferred rent budget to help me pinpoint the best living options.`,
        realWorldInsights: insightSnippets,
      };
    }

    // 2. Query OpenAI GPT-4o-mini with ground-truth search context
    try {
      const systemPrompt = `You are "thikanakhojo.com AI Assistant", an expert, pragmatic, and highly empathetic relocation consultant specializing in Indian tech hubs (Bengaluru, Kolkata, Mumbai, Pune, Hyderabad).
Your goal is to provide honest, grounded, and genuinely helpful real-world advice to home-seekers.

CRITICAL GUIDELINES:
1. Always address commute realities (peak traffic vs off-peak, metro access vs road bottlenecks like Silk Board, Outer Ring Road, EM Bypass, Hinjewadi).
2. Highlight daily-life factors: power backup consistency, water supply, late-night safety, food delivery / grocery access (Blinkit/Zepto/Instamart), and high-speed fiber availability.
3. Refer specifically to the provided verified property listings with realistic rent expectations and fair price tips.
4. Keep the tone professional, welcoming, concise, and structured with clean bullet points.`;

      const candidateContext = topProperties.map((p, idx) => ({
        rank: idx + 1,
        title: p.title,
        rent: `₹${p.rent.toLocaleString("en-IN")}/mo`,
        locality: p.locality,
        city: p.city,
        property_type: p.property_type,
        amenities: p.amenities.slice(0, 5),
        distance_km: p.distance_to_office_km ?? "TBD",
        commute_minutes: p.commute_estimate_minutes ?? "TBD",
        nearby_metro: p.nearby_metro,
      }));

      const userPrompt = `User Query: "${message}"

Extracted Intent:
- Office Location: ${intent.filters.office_location || "Not specified"}
- Max Budget: ${intent.filters.budget_max ? `₹${intent.filters.budget_max}` : "Flexible"}
- Lifestyle Preferences: ${intent.filters.preferences.join(", ") || "General comfort"}

Real-World Web / Ground-Truth Insights for Area:
${insightSnippets.join("\n")}

Top Ranked Property Candidates:
${JSON.stringify(candidateContext, null, 2)}

Provide your relocation recommendations and genuine advice tailored to the user.`;

      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 700,
      });

      const answer =
        response.choices[0]?.message?.content?.trim() ||
        "Here are your top relocation options based on commute and lifestyle signals.";

      return {
        answer,
        realWorldInsights: insightSnippets,
      };
    } catch (err) {
      console.warn("OpenAI API call failed, falling back to local synthesis:", (err as Error).message);
      const topTitles = topProperties.map((p) => `${p.title} (₹${p.rent.toLocaleString("en-IN")}/mo)`).join(", ");
      return {
        answer: `I found ${topProperties.length} strong options near ${intent.filters.office_location || primaryLocality}: ${topTitles}. ${insightSnippets[0] || ""}`,
        realWorldInsights: insightSnippets,
      };
    }
  }

  /**
   * Uses OpenAI structured completion to extract precise search intent from natural language.
   */
  async parseIntentWithLLM(query: string): Promise<Partial<SearchIntent> | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert intent extraction engine for an Indian real estate relocation platform.
Extract structured fields in valid JSON matching this schema:
{
  "target_location": string or null (the specific neighborhood, street, lane, tech park, or landmark the user wants to live in or near, e.g. "Tarulia Lane", "Kestopur", "Manyata Tech Park", "Baner", "Indiranagar", "BKC", "Candor Gate 2"),
  "office_location": string or null (workplace/office landmark if explicitly distinct from home search location),
  "city": string or null (one of "Kolkata", "Bangalore", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"),
  "budget_max": number in INR or null,
  "property_types": array of strings (e.g. ["1BHK", "2BHK", "3BHK", "PG", "Studio", "apartment"]),
  "amenities": array of strings (e.g. ["WiFi", "Gym", "Power Backup", "Parking", "Security", "Pool"]),
  "preferences": array of strings (e.g. ["peaceful", "safety", "metro connectivity", "low traffic", "food access"]),
  "inferred_lifestyle": array of strings
}`,
          },
          { role: "user", content: query },
        ],
        temperature: 0.1,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      const targetLoc = parsed.target_location || parsed.office_location || undefined;

      return {
        filters: {
          office_location: targetLoc,
          city: parsed.city || undefined,
          budget_max: parsed.budget_max || undefined,
          property_types: parsed.property_types || [],
          locality_ids: [],
          amenities: parsed.amenities || [],
          transport_modes: [],
          preferences: parsed.preferences || [],
        },
        inferred_lifestyle: parsed.inferred_lifestyle || parsed.preferences || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolves coordinates for Indian sub-localities, lanes, roads, and tech parks using LLM GIS knowledge.
   */
  async resolveLocationWithLLM(location: string, city: string): Promise<[number, number] | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert Indian GIS geocoder with exhaustive knowledge of neighborhoods, sub-localities, streets, colonies, and IT corridors in Kolkata, Bangalore, Pune, Mumbai, Hyderabad, and Delhi NCR.
Return the exact GPS coordinates [longitude, latitude] and parent locality in valid JSON:
{
  "coordinates": [number, number], // [longitude, latitude] e.g. [88.4380, 22.5870] for Tarulia Lane / Kestopur Kolkata
  "parent_locality": string,
  "confidence": number // 0 to 1
}`,
          },
          {
            role: "user",
            content: `Location: "${location}", City: "${city}"`,
          },
        ],
        temperature: 0.0,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      if (Array.isArray(parsed.coordinates) && parsed.coordinates.length === 2) {
        const lon = Number(parsed.coordinates[0]);
        const lat = Number(parsed.coordinates[1]);
        if (!isNaN(lon) && !isNaN(lat) && lon > 65 && lon < 95 && lat > 8 && lat < 36) {
          return [lon, lat];
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}
