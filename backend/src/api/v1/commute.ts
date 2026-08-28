import { Router, Request, Response } from "express";
import { CommuteService } from "../../services/commute.js";

export const commuteRouter = Router();

// POST /api/v1/commute/estimate
commuteRouter.post("/estimate", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const estimates = await new CommuteService().estimate(
      payload.origin || "Selected locality",
      payload.destination || "Office",
      payload.modes
    );
    res.json(estimates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
