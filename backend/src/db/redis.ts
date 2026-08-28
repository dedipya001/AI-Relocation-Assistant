import { Redis } from "ioredis";
import { config } from "../core/config.js";
import { logger } from "../core/logger.js";

let redisClient: Redis | null = null;

export async function connectRedis(): Promise<Redis | null> {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying if Redis is not available
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on("error", (err) => {
      logger.warn({ error: err.message }, "redis_error");
    });

    await redisClient.connect();
    await redisClient.ping();
    logger.info("redis_connected");
    return redisClient;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, "redis_connection_warning");
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("redis_closed");
  }
}

export function getRedis(): Redis | null {
  return redisClient;
}
