import { z } from "zod";
import { ScoringWeightsSchema } from "./ai.js";

export const AgeGroupSchema = z.enum(["18-24", "25-32", "33-45", "46+"]);
export const ShortlistStatusSchema = z.enum([
  "bookmarked",
  "contacted",
  "scheduled_visit",
  "negotiating",
  "rejected",
  "finalized",
]);

export const GuestProfileSchema = z.object({
  age_group: AgeGroupSchema,
  gender: z.string().trim().min(1).max(50),
  profession: z.string().trim().min(1).max(120),
  target_budget: z.number().positive().max(10_000_000),
  preferred_city: z.string().trim().min(1).max(120),
  priority_amenities: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});
export type GuestProfile = z.infer<typeof GuestProfileSchema>;

export const GuestProfileRequestSchema = GuestProfileSchema;

export const SignupRequestSchema = z
  .object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
    password: z.string().min(8).max(200).optional(),
    google_id_token: z.string().min(20).optional(),
    guest_profile: GuestProfileSchema.optional(),
    guest_saved_properties: z.array(z.string().trim().min(1)).max(100).default([]),
  })
  .refine((value) => Boolean(value.google_id_token || (value.email && value.password)), {
    message: "email/password or google_id_token is required",
  });

export const LoginRequestSchema = z
  .object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
    password: z.string().min(8).max(200).optional(),
    google_id_token: z.string().min(20).optional(),
  })
  .refine((value) => Boolean(value.google_id_token || (value.email && value.password)), {
    message: "email/password or google_id_token is required",
  });

export const UserProfileUpdateSchema = z.object({
  profile: GuestProfileSchema.partial().optional(),
  weight_overrides: ScoringWeightsSchema.partial().optional(),
  notification_preferences: z
    .object({
      price_drops: z.boolean().optional(),
      new_listings: z.boolean().optional(),
      product_updates: z.boolean().optional(),
    })
    .optional(),
});

export const ShortlistItemInputSchema = z.object({
  property_id: z.string().trim().min(1),
  notes: z.string().trim().max(2000).default(""),
  status: ShortlistStatusSchema.default("bookmarked"),
});

export const ShortlistItemUpdateSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  status: ShortlistStatusSchema.optional(),
});

export type ShortlistStatus = z.infer<typeof ShortlistStatusSchema>;
export type ShortlistItemInput = z.infer<typeof ShortlistItemInputSchema>;

export interface StoredShortlistItem {
  property_id: string;
  notes: string;
  status: ShortlistStatus;
  added_at: string;
  updated_at: string;
  property_snapshot?: Record<string, unknown> | null;
}

export interface UserDocument {
  _id?: unknown;
  email: string;
  password_hash?: string;
  google_sub?: string;
  profile?: Partial<GuestProfile>;
  weight_overrides?: Record<string, number>;
  search_history: Array<Record<string, unknown>>;
  shortlists: StoredShortlistItem[];
  notification_preferences: {
    price_drops: boolean;
    new_listings: boolean;
    product_updates: boolean;
  };
  share_token?: string;
  created_at: string;
  updated_at: string;
}
