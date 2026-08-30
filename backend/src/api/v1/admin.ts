import { Router, Request, Response } from "express";
import { AdEventInSchema } from "../../models/analytics.js";
import { analyticsService } from "../../services/analyticsService.js";

export const adminRouter = Router();

// GET /api/v1/admin/dashboard
adminRouter.get("/dashboard", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getDashboardOverview();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/costs/openai
adminRouter.get("/costs/openai", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getOpenAICosts();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/costs/mapbox
adminRouter.get("/costs/mapbox", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getMapboxCosts();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/trends/searches
adminRouter.get("/trends/searches", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getSearchTrends();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/trends/demand
adminRouter.get("/trends/demand", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getPropertyDemandTrends();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/trends/demographics
adminRouter.get("/trends/demographics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getDemographicsAndFeatureDemand();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/admin/ads/events
adminRouter.post("/ads/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = AdEventInSchema.parse(req.body);
    const event = await analyticsService.logAdEvent(parsed);
    res.json({
      status: "recorded",
      event,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/ads/performance
adminRouter.get("/ads/performance", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getAdPerformance();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/admin/goals
adminRouter.get("/goals", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await analyticsService.getMonetizationGoals();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
