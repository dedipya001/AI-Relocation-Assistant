import { z } from "zod";
import { GeoPointSchema, SourcePlatform } from "./common.js";

export const PriceObservationSchema = z.object({
  source: z.nativeEnum(SourcePlatform),
  rent: z.number(),
  url: z.string().nullable().optional(),
  observed_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type PriceObservation = z.infer<typeof PriceObservationSchema>;

export const PropertyBaseSchema = z.object({
  title: z.string(),
  source_platform: z.nativeEnum(SourcePlatform),
  source_url: z.string().nullable().optional(),
  property_type: z.string(),
  rent: z.number(),
  deposit: z.number().nullable().optional(),
  area_sqft: z.number().nullable().optional(),
  furnishing: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  location: GeoPointSchema,
  locality_id: z.string(),
  nearby_metro: z.string().nullable().optional(),
  commute_estimate_minutes: z.number().nullable().optional(),
  dedupe_key: z.string(),
  price_history: z.array(PriceObservationSchema).default([]),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
  updated_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type PropertyBase = z.infer<typeof PropertyBaseSchema>;

export const PropertySchema = PropertyBaseSchema.extend({
  _id: z.string().optional(),
  lowest_price: PriceObservationSchema.nullable().optional(),
  average_negotiated_rent: z.number().nullable().optional(),
  estimated_fair_rent: z.number().nullable().optional(),
  distance_to_office_km: z.number().optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  is_active: z.boolean().optional(),
  scrape_run_id: z.string().optional(),
  last_seen_at: z.union([z.date(), z.string()]).optional(),
});
export type Property = z.infer<typeof PropertySchema>;

export const PropertySearchFiltersSchema = z.object({
  office_location: z.string().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  property_types: z.array(z.string()).default([]),
  locality_ids: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  transport_modes: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
});
export type PropertySearchFilters = z.infer<typeof PropertySearchFiltersSchema>;
