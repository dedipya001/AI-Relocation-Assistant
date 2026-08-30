import { z } from "zod";
import { PropertySearchFiltersSchema } from "./property.js";

export const ScoringWeightsSchema = z.object({
  affordability: z.number().min(0).max(1).default(0.24),
  commute: z.number().min(0).max(1).default(0.24),
  safety: z.number().min(0).max(1).default(0.20),
  internet: z.number().min(0).max(1).default(0.14),
  food_access: z.number().min(0).max(1).default(0.10),
  lifestyle_fit: z.number().min(0).max(1).default(0.08),
  property_quality: z.number().min(0).max(1).default(0.00),
});
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export const ScoringProfileEnum = z.enum([
  "balanced",
  "budget_saver",
  "tech_professional",
  "safety_priority",
  "family_first",
  "night_owl",
  "custom",
]);
export type ScoringProfile = z.infer<typeof ScoringProfileEnum>;

export const HardConstraintsSchema = z.object({
  max_budget: z.number().positive().nullable().optional(),
  max_commute_minutes: z.number().positive().nullable().optional(),
  min_safety_score: z.number().min(0).max(100).nullable().optional(),
  min_internet_score: z.number().min(0).max(100).nullable().optional(),
  min_food_access_score: z.number().min(0).max(100).nullable().optional(),
  must_have_amenities: z.array(z.string()).optional().default([]),
  allowed_property_types: z.array(z.string()).optional().default([]),
});
export type HardConstraints = z.infer<typeof HardConstraintsSchema>;

export const SubScoreDetailSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  contribution: z.number(),
  label: z.string(),
  details: z.string(),
});
export type SubScoreDetail = z.infer<typeof SubScoreDetailSchema>;

export const PenaltyDetailSchema = z.object({
  reason: z.string(),
  penalty_points: z.number(),
});
export type PenaltyDetail = z.infer<typeof PenaltyDetailSchema>;

export const SearchIntentSchema = z.object({
  query: z.string(),
  filters: PropertySearchFiltersSchema,
  inferred_lifestyle: z.array(z.string()).default([]),
  follow_up_questions: z.array(z.string()).default([]),
});
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const RecommendationScoreSchema = z.object({
  affordability: z.number(),
  commute: z.number(),
  safety: z.number(),
  internet: z.number(),
  food_access: z.number(),
  lifestyle_fit: z.number(),
  property_quality: z.number().default(70),
  total: z.number(),
  confidence_score: z.number().default(85),
  explanation: z.string(),
  subscores: z.record(SubScoreDetailSchema).optional(),
  penalties: z.array(PenaltyDetailSchema).default([]),
});
export type RecommendationScore = z.infer<typeof RecommendationScoreSchema>;

export const AIRecommendationSchema = z.object({
  rank: z.number().optional(),
  entity_type: z.string(),
  entity_id: z.string(),
  title: z.string(),
  locality_name: z.string().nullable().optional(),
  source_platform: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  listing_url: z.string().nullable().optional(),
  provider_url: z.string().nullable().optional(),
  rent: z.number().optional(),
  deposit: z.number().nullable().optional(),
  distance_km: z.number().optional(),
  commute_minutes: z.number().optional(),
  furnishing: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  score: RecommendationScoreSchema,
  highlights: z.array(z.string()).default([]),
  tradeoffs: z.array(z.string()).default([]),
  constraint_violations: z.array(z.string()).default([]),
  scoring_profile: z.string().default("balanced"),
  is_eligible: z.boolean().default(true),
});
export type AIRecommendation = z.infer<typeof AIRecommendationSchema>;

export const RankRequestSchema = z.object({
  properties: z.array(z.record(z.any())),
  localities_by_id: z.record(z.record(z.any())).optional(),
  profile: ScoringProfileEnum.optional(),
  weights: ScoringWeightsSchema.partial().optional(),
  hard_constraints: HardConstraintsSchema.optional(),
  preferences: z.array(z.string()).default([]),
  budget_max: z.number().nullable().optional(),
});
export type RankRequest = z.infer<typeof RankRequestSchema>;

export const AISummarySchema = z.object({
  _id: z.string().optional(),
  entity_type: z.string(),
  entity_id: z.string(),
  summary: z.string(),
  source_count: z.number(),
  model: z.string(),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type AISummary = z.infer<typeof AISummarySchema>;
