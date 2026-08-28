import crypto from "crypto";
import { config } from "../core/config.js";
import { getRedis } from "../db/redis.js";

export function cacheKey(namespace: string, payload: any): string {
  const serialized = JSON.stringify(payload, Object.keys(payload || {}).sort());
  const digest = crypto.createHash("sha256").update(serialized).digest("hex");
  return `${config.cachePrefix}:${namespace}:${digest}`;
}

export async function getJson<T = any>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: any, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Gracefully handle cache write failures
  }
}
