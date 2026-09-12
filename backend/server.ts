import http from "node:http";
import { config } from "./src/core/config.js";
import { logger } from "./src/core/logger.js";
import { closeMongo, connectMongo } from "./src/db/mongo.js";
import { closeRedis, connectRedis } from "./src/db/redis.js";
import { createServer } from "./src/server.js";

async function bootstrap() {
  try {
    await connectMongo();
    await connectRedis();

    const app = createServer();
    const server = http.createServer(app);
    const port = Number(process.env.PORT ?? config.port);

    server.listen(port, "0.0.0.0", () => {
      logger.info(
        {
          host: "0.0.0.0",
          port,
          env: config.ENVIRONMENT,
        },
        `AI Relocation Intelligence API running on port ${port}`
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
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    logger.fatal({ error }, "bootstrap_failed");
    process.exit(1);
  }
}

void bootstrap();
