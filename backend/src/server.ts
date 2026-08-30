import cors from "cors";
import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./api/v1/router.js";
import { config } from "./core/config.js";
import { logger } from "./core/logger.js";

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

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", site: config.SITE_NAME, domain: config.SITE_DOMAIN });
  });

  // Root SEO & Verification Endpoints (AdSense & Search Engines)
  app.get("/ads.txt", (req: Request, res: Response) => {
    import("./api/v1/seo.js").then((m) => m.handleAdsTxt(req, res));
  });
  app.get("/robots.txt", (req: Request, res: Response) => {
    import("./api/v1/seo.js").then((m) => m.handleRobotsTxt(req, res));
  });
  app.get("/sitemap.xml", (req: Request, res: Response) => {
    import("./api/v1/seo.js").then((m) => m.handleSitemapXml(req, res));
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
