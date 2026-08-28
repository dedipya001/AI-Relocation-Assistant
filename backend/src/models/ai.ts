import { z } from "zod";
import { PropertySearchFiltersSchema } from "./property.js";

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
  total: z.number(),
  explanation: z.string(),
});
export type RecommendationScore = z.infer<typeof RecommendationScoreSchema>;

export const AIRecommendationSchema = z.object({
  entity_type: z.string(),
  entity_id: z.string(),
  title: z.string(),
  locality_name: z.string().nullable().optional(),
  score: RecommendationScoreSchema,
  highlights: z.array(z.string()).default([]),
  tradeoffs: z.array(z.string()).default([]),
});
export type AIRecommendation = z.infer<typeof AIRecommendationSchema>;

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
