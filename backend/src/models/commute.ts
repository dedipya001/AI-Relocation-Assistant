import { z } from "zod";
import { TransportMode } from "./common.js";

export const TimeSlotTrafficSchema = z.object({
  slot_name: z.string(), // e.g. "Morning Peak"
  time_range: z.string(), // "08:30 - 11:30"
  congestion_level: z.enum(["low", "moderate", "heavy", "severe"]),
  congestion_index: z.number().min(0).max(100),
  multiplier: z.number(),
  driving_minutes: z.number(),
  cab_minutes: z.number(),
  bike_taxi_minutes: z.number(),
  metro_minutes: z.number(),
  bus_minutes: z.number(),
  typical_delay_minutes: z.number(),
  recommendation: z.string(),
});
export type TimeSlotTraffic = z.infer<typeof TimeSlotTrafficSchema>;

export const HourlyTrafficSchema = z.object({
  hour: z.string(), // "09:00"
  hour_24: z.number(),
  congestion_index: z.number(),
  traffic_level: z.string(),
  driving_minutes: z.number(),
  bike_minutes: z.number(),
  metro_minutes: z.number(),
});
export type HourlyTraffic = z.infer<typeof HourlyTrafficSchema>;

export const ShuttleServiceRouteSchema = z.object({
  service_name: z.string(), // "Cityflo" | "HexaH2O" | "ShuttleSpeed"
  service_brand: z.string(), // "HexaH2O AC Micro-Transit", etc.
  route_code: z.string(),
  route_title: z.string(),
  pickup_point: z.string(),
  pickup_distance_meters: z.number(),
  pickup_walking_minutes: z.number(),
  dropoff_point: z.string(),
  morning_timings: z.array(z.string()),
  evening_timings: z.array(z.string()),
  frequency_minutes: z.number(),
  travel_time_minutes: z.number(),
  fare_per_ride_inr: z.number(),
  monthly_pass_inr: z.number(),
  amenities: z.array(z.string()),
  reliability_score: z.number().min(0).max(100),
  booking_app: z.string(),
  savings_vs_cab_pct: z.number(),
});
export type ShuttleServiceRoute = z.infer<typeof ShuttleServiceRouteSchema>;

export const TrafficDataSchema = z.object({
  aerial_distance_km: z.number(),
  road_distance_km: z.number(),
  base_driving_minutes: z.number(),
  current_traffic_condition: z.string(),
  time_slots: z.object({
    early_morning: TimeSlotTrafficSchema,
    morning_peak: TimeSlotTrafficSchema,
    midday: TimeSlotTrafficSchema,
    evening_peak: TimeSlotTrafficSchema,
    late_night: TimeSlotTrafficSchema,
  }),
  hourly_profile: z.array(HourlyTrafficSchema),
  bottlenecks: z.array(z.string()),
  shuttle_services: z.array(ShuttleServiceRouteSchema).default([]),
  fastest_mode_by_time: z.record(z.string()),
});
export type TrafficData = z.infer<typeof TrafficDataSchema>;

export const CommuteEstimateSchema = z.object({
  mode: z.nativeEnum(TransportMode),
  minutes: z.number(),
  monthly_cost: z.number(),
  reliability_score: z.number().min(0).max(100),
  peak_delay_minutes: z.number(),
  route_summary: z.string(),
  off_peak_minutes: z.number().optional(),
  peak_morning_minutes: z.number().optional(),
  peak_evening_minutes: z.number().optional(),
  distance_km: z.number().optional(),
});
export type CommuteEstimate = z.infer<typeof CommuteEstimateSchema>;

export const CommuteDataSchema = z.object({
  _id: z.string().optional(),
  origin_entity_type: z.string(),
  origin_entity_id: z.string(),
  destination: z.string(),
  estimates: z.array(CommuteEstimateSchema),
  traffic_data: TrafficDataSchema.optional(),
  shuttle_routes: z.array(ShuttleServiceRouteSchema).default([]),
  provider: z.string(),
  created_at: z.union([z.date(), z.string()]).default(() => new Date().toISOString()),
});
export type CommuteData = z.infer<typeof CommuteDataSchema>;
