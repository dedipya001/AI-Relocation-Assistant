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
});
export type Locality = z.infer<typeof LocalitySchema>;
