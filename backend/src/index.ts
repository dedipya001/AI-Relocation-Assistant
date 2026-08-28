import http from "http";
import { config } from "./core/config.js";
import { logger } from "./core/logger.js";
import { closeMongo, connectMongo } from "./db/mongo.js";
import { closeRedis, connectRedis } from "./db/redis.js";
import { createServer } from "./server.js";

async function bootstrap() {
  try {
    await connectMongo();
    await connectRedis();

    const app = createServer();
    const server = http.createServer(app);

    server.listen(config.port, config.API_HOST, () => {
      logger.info(
        {
          host: config.API_HOST,
          port: config.port,
          env: config.ENVIRONMENT,
        },
        `AI Relocation Intelligence API running at http://${config.API_HOST}:${config.port}`
      );
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, "shutting_down_server");
      server.close(async () => {
        await closeRedis();
        await closeMongo();
        logger.info("server_stopped_cleanly");
        process.exit(0);
      });

      // Force shutdown after 10s if graceful fails
      setTimeout(() => {
        logger.error("forced_shutdown_due_to_timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logger.fatal({ error }, "bootstrap_failed");
    process.exit(1);
  }
}

bootstrap();
