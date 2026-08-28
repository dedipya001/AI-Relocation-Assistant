import { z } from "zod";

export const NegotiatedRentInSchema = z.object({
  property_id: z.string().nullable().optional(),
  locality_id: z.string(),
  listed_rent: z.number(),
  negotiated_rent: z.number(),
  broker_commission: z.number().nullable().optional(),
  maintenance_charges: z.number().nullable().optional(),
  hidden_costs: z.array(z.string()).default([]),
});
export type NegotiatedRentIn = z.infer<typeof NegotiatedRentInSchema>;

export const NegotiatedRentSchema = NegotiatedRentInSchema.extend({
  _id: z.string().optional(),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type NegotiatedRent = z.infer<typeof NegotiatedRentSchema>;

export const UserFeedbackInSchema = z.object({
  locality_id: z.string(),
  category: z.string(),
  score: z.number().min(0).max(100),
  comment: z.string().nullable().optional(),
});
export type UserFeedbackIn = z.infer<typeof UserFeedbackInSchema>;

export const UserFeedbackSchema = UserFeedbackInSchema.extend({
  _id: z.string().optional(),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type UserFeedback = z.infer<typeof UserFeedbackSchema>;
