import { z } from "zod";
import { TransportMode } from "./common.js";

export const CommuteEstimateSchema = z.object({
  mode: z.nativeEnum(TransportMode),
  minutes: z.number(),
  monthly_cost: z.number(),
  reliability_score: z.number().min(0).max(100),
  peak_delay_minutes: z.number(),
  route_summary: z.string(),
});
export type CommuteEstimate = z.infer<typeof CommuteEstimateSchema>;

export const CommuteDataSchema = z.object({
  _id: z.string().optional(),
  origin_entity_type: z.string(),
  origin_entity_id: z.string(),
  destination: z.string(),
  estimates: z.array(CommuteEstimateSchema),
  provider: z.string(),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type CommuteData = z.infer<typeof CommuteDataSchema>;
