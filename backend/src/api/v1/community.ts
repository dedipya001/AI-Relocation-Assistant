import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { ingestTelegramUpdate, type TelegramUpdate } from "../../services/communityTelegram.js";

export const communityRouter = Router();

communityRouter.get("/telegram/status", (_req: Request, res: Response) => {
  res.json({
    mode: "telegram-bot-webhook",
    configured: Boolean(config.TELEGRAM_WEBHOOK_SECRET),
    realtime: true,
    credential_required_in_production: true,
    supported_cities: ["Kolkata", "Bengaluru", "Pune", "Hyderabad"],
    privacy: "raw phone numbers and Telegram usernames are not persisted; only masked contact hints are stored",
  });
});

communityRouter.post("/telegram/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    const configuredSecret = config.TELEGRAM_WEBHOOK_SECRET;
    const providedSecret = req.header("x-telegram-bot-api-secret-token");
    if (configuredSecret && providedSecret !== configuredSecret) {
      res.status(401).json({ ok: false, error: "Invalid Telegram webhook secret." });
      return;
    }
    if (!configuredSecret && config.ENVIRONMENT === "production") {
      res.status(503).json({ ok: false, error: "Telegram webhook secret is not configured." });
      return;
    }

    const result = await ingestTelegramUpdate(req.body as TelegramUpdate);
    // Telegram should receive 200 even for ignored/non-listing updates so it does not retry them.
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});
