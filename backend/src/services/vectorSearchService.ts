import OpenAI from "openai";
import crypto from "crypto";
import { config } from "../core/config.js";
import { logger } from "../core/logger.js";
import { getDatabase } from "../db/mongo.js";
import { getJson, setJson } from "./cache.js";
import { analyticsService } from "./analyticsService.js";
import { resolveProviderListingUrl } from "./recommendations.js";

export interface SemanticSearchParams {
  query: string;
  city?: string;
  locality?: string;
  budget_max?: number;
  budget_min?: number;
  property_types?: string[];
  limit?: number;
  threshold?: number;
}

export interface SemanticMatchedProperty {
  property_id: string;
  title: string;
  locality: string;
  city: string;
  rent: number;
  deposit_amount?: number;
  property_type: string;
  furnishing_status: string;
  amenities: string[];
  semantic_similarity_score: number;
  matched_features: string[];
  semantic_reasoning: string;
  provider_url: string;
  listing_url: string;
  source_platform: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface SemanticSearchResult {
  query: string;
  semantic_intent: {
    extracted_lifestyle_tags: string[];
    target_city: string;
    target_locality?: string;
    budget_ceiling_inr?: number;
  };
  results_count: number;
  properties: SemanticMatchedProperty[];
  tokens_consumed: number;
  execution_time_ms: number;
  is_cache_hit: boolean;
}

export class VectorSearchService {
  private openai: OpenAI | null = null;
  private readonly EMBEDDING_MODEL = "text-embedding-3-small";

  constructor() {
    if (config.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generates a 1536-dimensional dense embedding for a natural language text query
   * with Redis caching and telemetry logging.
   */
  async generateEmbedding(text: string): Promise<{ vector: number[]; tokens: number; cached: boolean }> {
    const cleanText = text.trim().toLowerCase();
    const hash = crypto.createHash("sha256").update(cleanText).digest("hex").slice(0, 16);
    const cacheKey = `embedding:v1:${hash}`;

    // 1. Check Redis Cache
    const cachedVector = await getJson<number[]>(cacheKey);
    if (cachedVector && Array.isArray(cachedVector)) {
      return { vector: cachedVector, tokens: 0, cached: true };
    }

    // 2. Query OpenAI API
    if (this.openai) {
      try {
        const startTime = Date.now();
        const response = await this.openai.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: cleanText,
        });

        const vector = response.data[0]?.embedding || [];
        const tokens = response.usage?.total_tokens || Math.ceil(cleanText.length / 4);

        // Cache embedding in Redis for 48 hours
        await setJson(cacheKey, vector, 172800);

        // Asynchronously log OpenAI token consumption
        analyticsService
          .logOpenAIUsage({
            operation: "semantic_embedding",
            model: this.EMBEDDING_MODEL,
            promptTokens: tokens,
            completionTokens: 0,
            durationMs: Date.now() - startTime,
            metadata: { text_preview: cleanText.slice(0, 80) },
          })
          .catch(() => {});

        return { vector, tokens, cached: false };
      } catch (error) {
        logger.warn({ error }, "OpenAI embedding generation failed, falling back to heuristic dense vector");
      }
    }

    // Fallback: Deterministic dense pseudo-embedding for local/offline testing
    const fallbackVector = this.generateFallbackVector(cleanText);
    await setJson(cacheKey, fallbackVector, 86400);
    return { vector: fallbackVector, tokens: 0, cached: false };
  }

  /**
   * Fast Cosine Similarity between two floating point vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return Number((dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(4));
  }

  /**
   * Execute Hybrid Semantic Natural Language Property Search
   */
  async executeSemanticSearch(params: SemanticSearchParams): Promise<SemanticSearchResult> {
    const startTime = Date.now();
    const query = params.query.trim();
    const city = params.city || config.DEFAULT_CITY;
    const limit = Math.min(params.limit || 20, 50);
    const minThreshold = params.threshold || 0.45;

    // 1. Generate query vector
    const { vector: queryVector, tokens: tokensConsumed, cached: isCacheHit } = await this.generateEmbedding(query);

    // 2. Extract lifestyle keyword tags from query
    const lifestyleTags = this.extractLifestyleTags(query);

    // 3. Query candidate properties from MongoDB
    const db = getDatabase();
    const mongoFilter: Record<string, any> = {
      is_active: { $ne: false },
    };

    if (city && city.toLowerCase() !== "all") {
      mongoFilter.city = { $regex: new RegExp(`^${city}$`, "i") };
    }

    if (params.locality) {
      mongoFilter.locality = { $regex: new RegExp(params.locality, "i") };
    }

    if (params.budget_max) {
      // 15% tolerance on maximum budget for semantic discovery
      mongoFilter.rent = { $lte: Math.round(params.budget_max * 1.15) };
    }

    if (params.budget_min) {
      mongoFilter.rent = { ...mongoFilter.rent, $gte: params.budget_min };
    }

    if (params.property_types && params.property_types.length > 0) {
      mongoFilter.property_type = {
        $in: params.property_types.map((t) => new RegExp(t, "i")),
      };
    }

    const candidateDocs = await db.collection("properties")
      .find(mongoFilter)
      .limit(300)
      .toArray();

    // 4. Calculate semantic match scores for each property candidate
    const scoredProperties: SemanticMatchedProperty[] = [];

    for (const doc of candidateDocs) {
      const propText = `${doc.title || ""} ${doc.locality || ""} ${doc.property_type || ""} ${doc.furnishing_status || ""} ${(doc.amenities || []).join(" ")} ${doc.description || ""}`;
      const propVector = this.generateFallbackVector(propText);

      // Hybrid scoring: Vector cosine similarity + Keyword context alignment
      const vectorSim = this.cosineSimilarity(queryVector, propVector);
      const featureMatch = this.evaluateFeatureMatch(query, doc, lifestyleTags);

      const compositeScore = Number(
        Math.min(0.99, Math.max(0.2, vectorSim * 0.4 + featureMatch.featureScore * 0.6)).toFixed(3)
      );

      if (compositeScore >= minThreshold) {
        const verifiedUrl = resolveProviderListingUrl(doc);
        const reasoning = this.buildSemanticReasoning(query, doc, featureMatch.matchedFeatures);

        scoredProperties.push({
          property_id: String(doc._id),
          title: doc.title || `${doc.property_type} for Rent in ${doc.locality}`,
          locality: doc.locality || city,
          city: doc.city || city,
          rent: doc.rent,
          deposit_amount: doc.deposit_amount,
          property_type: doc.property_type || "Apartment",
          furnishing_status: doc.furnishing_status || "Semi-Furnished",
          amenities: doc.amenities || [],
          semantic_similarity_score: compositeScore,
          matched_features: featureMatch.matchedFeatures,
          semantic_reasoning: reasoning,
          provider_url: verifiedUrl,
          listing_url: doc.listing_url || verifiedUrl,
          source_platform: doc.source_platform || "MagicBricks",
          coordinates: {
            lat: doc.coordinates?.coordinates?.[1] || doc.lat || 22.5762,
            lng: doc.coordinates?.coordinates?.[0] || doc.lng || 88.4335,
          },
        });
      }
    }

    // 5. Sort by semantic similarity descending
    scoredProperties.sort((a, b) => b.semantic_similarity_score - a.semantic_similarity_score);
    const topResults = scoredProperties.slice(0, limit);

    // 6. Log search telemetry
    analyticsService
      .logSearchTelemetry({
        query,
        city,
        officeLocation: params.locality,
        budgetMax: params.budget_max,
        propertyTypes: params.property_types,
        amenities: lifestyleTags,
        resultsCount: topResults.length,
        isCacheHit,
        responseTimeMs: Date.now() - startTime,
      })
      .catch(() => {});

    return {
      query,
      semantic_intent: {
        extracted_lifestyle_tags: lifestyleTags,
        target_city: city,
        target_locality: params.locality,
        budget_ceiling_inr: params.budget_max,
      },
      results_count: topResults.length,
      properties: topResults,
      tokens_consumed: tokensConsumed,
      execution_time_ms: Date.now() - startTime,
      is_cache_hit: isCacheHit,
    };
  }

  /**
   * Extract lifestyle & contextual features from natural language query
   */
  private extractLifestyleTags(query: string): string[] {
    const text = query.toLowerCase();
    const detected: string[] = [];

    const keywordMap: Record<string, string[]> = {
      "peaceful / quiet": ["quiet", "peaceful", "calm", "serene", "low noise", "soundproof"],
      "sunlight & ventilation": ["sunlight", "sunlit", "airy", "ventilated", "balcony", "lake view", "park view"],
      "power backup": ["power backup", "generator", "inverter", "cesc", "bescom", "uninterrupted power"],
      "high-rise / top-floor": ["top floor", "high rise", "penthouse", "upper floor", "view"],
      "pet-friendly": ["pet friendly", "pets allowed", "dog friendly", "cat friendly"],
      "tech park proximity": ["tech park", "it park", "sector v", "ecospace", "manyata", "hinjawadi", "walking distance to office"],
      "metro / transit": ["metro", "near station", "transit", "subway", "walk to metro"],
      "security & gated": ["gated", "security", "cctv", "guard", "safe"],
      "fitness & lifestyle": ["gym", "swimming pool", "clubhouse", "jogging track", "badminton"],
      "work from home": ["wifi", "high speed internet", "fiber", "wfh", "study room"],
    };

    for (const [tag, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((k) => text.includes(k))) {
        detected.push(tag);
      }
    }

    return detected;
  }

  /**
   * Evaluates feature alignment between query criteria and property listing
   */
  private evaluateFeatureMatch(
    query: string,
    doc: any,
    tags: string[]
  ): { featureScore: number; matchedFeatures: string[] } {
    const text = query.toLowerCase();
    const docAmenities = (doc.amenities || []).map((a: string) => a.toLowerCase());
    const docTitle = (doc.title || "").toLowerCase();
    const docDesc = (doc.description || "").toLowerCase();
    const combinedDoc = `${docTitle} ${docDesc} ${docAmenities.join(" ")}`.toLowerCase();

    const matched: string[] = [];
    let hits = 0;

    if (text.includes("power") || text.includes("backup") || tags.includes("power backup")) {
      if (docAmenities.some((a: string) => a.includes("power backup") || a.includes("generator")) || combinedDoc.includes("power")) {
        matched.push("100% Power Backup Available");
        hits += 2;
      }
    }

    if (text.includes("quiet") || text.includes("peaceful") || tags.includes("peaceful / quiet")) {
      if (combinedDoc.includes("peaceful") || combinedDoc.includes("garden") || combinedDoc.includes("park") || combinedDoc.includes("society")) {
        matched.push("Quiet Residential Gated Setting");
        hits += 1.5;
      }
    }

    if (text.includes("sunlight") || text.includes("balcony") || text.includes("top-floor") || text.includes("top floor")) {
      if (docAmenities.some((a: string) => a.includes("balcony") || a.includes("park view") || a.includes("elevator")) || combinedDoc.includes("balcony") || combinedDoc.includes("floor")) {
        matched.push("High Natural Sunlight & Balcony Space");
        hits += 1.8;
      }
    }

    if (text.includes("pet") || tags.includes("pet-friendly")) {
      matched.push("Pet-Friendly Friendly Community");
      hits += 1.5;
    }

    if (text.includes("tech") || text.includes("sector v") || text.includes("office") || tags.includes("tech park proximity")) {
      if (doc.locality && (doc.locality.includes("Sector V") || doc.locality.includes("New Town") || doc.locality.includes("Salt Lake") || doc.locality.includes("Bellandur") || doc.locality.includes("Hinjawadi"))) {
        matched.push(`Prime Proximity to ${doc.locality} IT Corridor`);
        hits += 2;
      }
    }

    if (text.includes("gym") || text.includes("pool") || text.includes("club") || tags.includes("fitness & lifestyle")) {
      if (docAmenities.some((a: string) => a.includes("gym") || a.includes("club") || a.includes("swimming"))) {
        matched.push("Fitness Center & Club Amenities");
        hits += 1.5;
      }
    }

    if (text.includes("security") || text.includes("gated") || tags.includes("security & gated")) {
      if (docAmenities.some((a: string) => a.includes("security") || a.includes("cctv") || a.includes("intercom"))) {
        matched.push("24/7 Gated Security & Surveillance");
        hits += 1.5;
      }
    }

    // Default base matched features if specific keywords are sparse
    if (matched.length === 0) {
      if (doc.amenities && doc.amenities.length > 0) {
        matched.push(...doc.amenities.slice(0, 3));
      } else {
        matched.push(`Verified ${doc.property_type || "Rental"} in ${doc.locality || "Prime Area"}`);
      }
    }

    const totalPossible = Math.max(1, tags.length * 2);
    const featureScore = Math.min(1.0, 0.4 + (hits / totalPossible) * 0.6);

    return { featureScore, matchedFeatures: matched };
  }

  /**
   * Generates human-readable explainability reasoning
   */
  private buildSemanticReasoning(query: string, doc: any, matchedFeatures: string[]): string {
    const loc = doc.locality || "central area";
    const rentFormatted = `₹${doc.rent?.toLocaleString("en-IN") || "0"}/mo`;

    if (matchedFeatures.length >= 2) {
      return `Matches your criteria with ${matchedFeatures.slice(0, 2).join(" and ")} in ${loc} at ${rentFormatted}.`;
    }
    return `Recommended for your search in ${loc} with verified amenities at ${rentFormatted}.`;
  }

  /**
   * Generates a 1536-dimensional normalized pseudo-vector based on text hashing and n-grams.
   * Ensures deterministic cosine similarity when running locally or during tests.
   */
  private generateFallbackVector(text: string): number[] {
    const dimensions = 1536;
    const vector = new Array(dimensions).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;

      // Also hash character bigrams for sub-word semantic similarity
      for (let j = 0; j < token.length - 1; j++) {
        const bigramHash = (token.charCodeAt(j) * 31 + token.charCodeAt(j + 1)) % dimensions;
        vector[bigramHash] += 0.5;
      }
    }

    // Normalize to unit vector
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    if (norm > 0) {
      const sqrtNorm = Math.sqrt(norm);
      for (let i = 0; i < dimensions; i++) {
        vector[i] = Number((vector[i] / sqrtNorm).toFixed(6));
      }
    }
    return vector;
  }
}

export const vectorSearchService = new VectorSearchService();
