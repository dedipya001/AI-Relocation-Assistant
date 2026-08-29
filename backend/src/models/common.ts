import { z } from "zod";

export const GeoPointSchema = z.object({
  type: z.literal("Point").default("Point"),
  coordinates: z.tuple([z.number(), z.number()]), // [lon, lat]
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export enum SourcePlatform {
  OpenStreetMap = "OpenStreetMap",
  Mapbox = "Mapbox Search",
  Housing = "Housing",
  MagicBricks = "MagicBricks",
  Acres99 = "99acres",
  NoBroker = "NoBroker",
  BrokerCRM = "Broker CRM",
  RERA = "RERA",
  Apify = "Apify",
  BrightData = "BrightData",
  Facebook = "Facebook",
  Telegram = "Telegram",
  Broker = "Local Broker",
  User = "User Submitted",
}

export enum TransportMode {
  Metro = "metro",
  Bus = "bus",
  Walking = "walking",
  Rapido = "rapido",
  Uber = "uber",
  Ola = "ola",
  Cityflow = "cityflow",
  Hexa = "hexa",
  ShuttleSpeed = "shuttle_speed",
}

export function utcNow(): Date {
  return new Date();
}

export function toIsoString(date?: Date | string | null): string {
  if (!date) return new Date().toISOString();
  return typeof date === "string" ? date : date.toISOString();
}
