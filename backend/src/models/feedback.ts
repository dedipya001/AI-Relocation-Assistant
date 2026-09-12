import { z } from "zod";

export const NegotiatedRentInSchema = z.object({
  property_id: z.string().nullable().optional(),
  locality_id: z.string().min(1),
  listed_rent: z.number().positive(),
  negotiated_rent: z.number().positive(),
  security_deposit_months: z.number().min(0).max(24).nullable().optional(),
  move_out_deductions: z.number().min(0).nullable().optional(),
  broker_commission: z.number().min(0).nullable().optional(),
  maintenance_charges: z.number().min(0).nullable().optional(),
  water_power_backup_charges: z.number().min(0).nullable().optional(),
  wifi_isp: z.string().max(80).nullable().optional(),
  wifi_speed_mbps: z.number().min(0).max(10000).nullable().optional(),
  hidden_costs: z.array(z.string().max(120)).max(20).default([]),
  _website: z.string().max(200).optional().default(""),
});
export type NegotiatedRentIn = z.infer<typeof NegotiatedRentInSchema>;

export const NegotiatedRentSchema = NegotiatedRentInSchema.omit({ _website: true }).extend({
  _id: z.string().optional(),
  verification_status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type NegotiatedRent = z.infer<typeof NegotiatedRentSchema>;

export const UserFeedbackInSchema = z.object({
  locality_id: z.string().min(1),
  category: z.string().default("community"),
  score: z.number().min(0).max(100).default(50),
  safety_score: z.number().min(0).max(100).nullable().optional(),
  noise_score: z.number().min(0).max(100).nullable().optional(),
  waterlogging_score: z.number().min(0).max(100).nullable().optional(),
  women_safety_score: z.number().min(0).max(100).nullable().optional(),
  late_night_score: z.number().min(0).max(100).nullable().optional(),
  internet_score: z.number().min(0).max(100).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  _website: z.string().max(200).optional().default(""),
});
export type UserFeedbackIn = z.infer<typeof UserFeedbackInSchema>;

export const UserFeedbackSchema = UserFeedbackInSchema.omit({ _website: true }).extend({
  _id: z.string().optional(),
  verification_status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type UserFeedback = z.infer<typeof UserFeedbackSchema>;
