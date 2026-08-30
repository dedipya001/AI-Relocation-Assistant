import { z } from "zod";
import { GeoPointSchema } from "./common.js";

export const LocalityScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  women_safety: z.number().min(0).max(100),
  late_night: z.number().min(0).max(100),
  internet: z.number().min(0).max(100),
  food_access: z.number().min(0).max(100),
  commute_reliability: z.number().min(0).max(100),
});
export type LocalityScore = z.infer<typeof LocalityScoreSchema>;

export const EssentialPlaceSchema = z.object({
  name: z.string(),
  category: z.string(),
  distance_meters: z.number(),
  rating: z.number().nullable().optional(),
});
export type EssentialPlace = z.infer<typeof EssentialPlaceSchema>;

export const LocalityBaseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  location: GeoPointSchema,
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  scores: LocalityScoreSchema,
  essentials: z.array(EssentialPlaceSchema).default([]),
  things_to_do: z.array(EssentialPlaceSchema).default([]),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
  updated_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type LocalityBase = z.infer<typeof LocalityBaseSchema>;

export const LocalitySchema = LocalityBaseSchema.extend({
  _id: z.string().optional(),
  score: z.number().optional(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  metrics: z.record(z.any()).optional(),
});
export type Locality = z.infer<typeof LocalitySchema>;

export const LocalityComparisonItemSchema = z.object({
  locality_id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  summary: z.string(),
  liveability_score: z.number(),
  scores: LocalityScoreSchema,
  rents: z.object({
    min_rent_inr: z.number(),
    median_1bhk_inr: z.number(),
    median_2bhk_inr: z.number(),
    median_3bhk_inr: z.number(),
    active_properties_count: z.number(),
  }),
  commute: z.object({
    destination: z.string(),
    aerial_distance_km: z.number(),
    road_distance_km: z.number(),
    peak_morning_minutes: z.number(),
    off_peak_minutes: z.number(),
    peak_evening_minutes: z.number(),
    metro_minutes: z.number().nullable().optional(),
    nearest_metro_station: z.string().nullable().optional(),
    primary_transport_options: z.array(z.string()),
  }),
  infrastructure: z.object({
    power_stability_rating: z.number(),
    power_provider: z.string(),
    water_quality_rating: z.number(),
    water_source: z.string(),
    top_fiber_providers: z.array(z.string()),
    quick_commerce_delivery_mins: z.number(),
  }),
  tags: z.array(z.string()),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  best_for_persona: z.string(),
});
export type LocalityComparisonItem = z.infer<typeof LocalityComparisonItemSchema>;

export const LocalityComparisonResponseSchema = z.object({
  city: z.string(),
  workplace: z.string(),
  localities: z.array(LocalityComparisonItemSchema),
  category_winners: z.object({
    affordability: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
    commute: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
    safety: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
    lifestyle: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
    infrastructure: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
    overall: z.object({ locality_id: z.string(), name: z.string(), reason: z.string() }),
  }),
  ai_synthesis: z.object({
    summary: z.string(),
    recommendation_verdict: z.string(),
    tradeoffs_summary: z.string(),
  }),
});
export type LocalityComparisonResponse = z.infer<typeof LocalityComparisonResponseSchema>;
