import cors from "cors";
import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./api/v1/router.js";
import { config } from "./core/config.js";
import { logger } from "./core/logger.js";
import { connectMongo } from "./db/mongo.js";
import { connectRedis } from "./db/redis.js";

let runtimeInitPromise: Promise<void> | null = null;

async function ensureRuntimeDependencies(): Promise<void> {
  if (!runtimeInitPromise) {
    runtimeInitPromise = Promise.all([connectMongo(), connectRedis()])
      .then(() => undefined)
      .catch((error) => {
        runtimeInitPromise = null;
        throw error;
      });
  }

  await runtimeInitPromise;
}

export function createServer(): Express {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Allow all local dev origins
          if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
            callback(null, true);
          } else {
            callback(null, true); // Permissive default for API usage
          }
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // HTTP Request Logging
  app.use(
    morgan("short", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

  // Health check endpoint stays independent of database/cache availability.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Initialize runtime dependencies lazily for serverless requests.
  app.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await ensureRuntimeDependencies();
      next();
    } catch (error) {
      next(error);
    }
  });

  // Mount API v1 router
  app.use("/api/v1", apiRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: err.message, stack: err.stack }, "unhandled_server_error");
    res.status(500).json({ error: "Internal Server Error", detail: err.message });
  });

  return app;
}

const app = createServer();
export default app;
