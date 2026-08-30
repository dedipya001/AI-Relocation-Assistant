import { z } from "zod";

// API Usage Log Schema (OpenAI, Mapbox)
export const ApiUsageLogSchema = z.object({
  _id: z.any().optional(),
  provider: z.enum(["openai", "mapbox", "brightdata", "apify"]),
  operation: z.string(), // e.g. "advisor_chat", "intent_parsing", "geocoding", "map_tiles"
  model: z.string().optional(), // e.g. "gpt-4o-mini", "text-embedding-3-small"
  prompt_tokens: z.number().default(0),
  completion_tokens: z.number().default(0),
  total_tokens: z.number().default(0),
  requests_count: z.number().default(1),
  estimated_cost_usd: z.number().default(0),
  estimated_cost_inr: z.number().default(0),
  duration_ms: z.number().optional(),
  status: z.enum(["success", "error", "cached"]).default("success"),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
});

export type ApiUsageLog = z.infer<typeof ApiUsageLogSchema>;

// Search Telemetry Schema
export const SearchTelemetrySchema = z.object({
  _id: z.any().optional(),
  query: z.string(),
  city: z.string().default("Kolkata"),
  office_location: z.string().optional(),
  target_locality: z.string().optional(),
  budget_max: z.number().optional(),
  property_types: z.array(z.string()).default([]),
  amenities_requested: z.array(z.string()).default([]),
  lifestyle_preferences: z.array(z.string()).default([]),
  inferred_age_group: z.enum(["18-24 (Gen-Z/Student)", "25-32 (Early-Career Pro)", "33-45 (Family/Mid-Career)", "46+ (Senior Exec)"]).default("25-32 (Early-Career Pro)"),
  results_count: z.number().default(0),
  is_cache_hit: z.boolean().default(false),
  response_time_ms: z.number().optional(),
  timestamp: z.string(),
});

export type SearchTelemetry = z.infer<typeof SearchTelemetrySchema>;

// Ad Telemetry Schema
export const AdEventInSchema = z.object({
  event_type: z.enum(["impression", "click", "conversion"]),
  ad_slot: z.enum(["header_banner", "locality_card_ad", "in_feed_sponsored", "sidebar_sticky", "exit_intent_modal"]),
  provider: z.enum(["adsense", "direct_sponsor", "affiliate_listing"]).default("adsense"),
  ad_unit_id: z.string().optional(),
  locality_id: z.string().optional(),
  property_id: z.string().optional(),
  cpc_estimate_inr: z.number().default(25.0),
  rpm_estimate_inr: z.number().default(150.0),
  client_id: z.string().optional(),
  page_url: z.string().optional(),
});

export const AdEventSchema = AdEventInSchema.extend({
  _id: z.any().optional(),
  estimated_revenue_inr: z.number().default(0),
  timestamp: z.string(),
});

export type AdEvent = z.infer<typeof AdEventSchema>;
export type AdEventIn = z.infer<typeof AdEventInSchema>;

// Demographic Segment Insight
export const DemographicInsightSchema = z.object({
  age_group: z.string(),
  label: z.string(),
  searches_share_pct: z.number(),
  average_budget_inr: z.number(),
  preferred_property_types: z.array(z.string()),
  top_demanded_amenities: z.array(z.object({
    amenity: z.string(),
    demand_index: z.number(), // 0-100
  })),
  top_searched_localities: z.array(z.string()),
});

export type DemographicInsight = z.infer<typeof DemographicInsightSchema>;
