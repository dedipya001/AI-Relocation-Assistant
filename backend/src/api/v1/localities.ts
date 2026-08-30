import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";

import { LocalityComparisonService } from "../../services/localityComparison.js";

export const localitiesRouter = Router();

// POST /api/v1/localities/compare
localitiesRouter.post("/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const db = getDatabase();
    const service = new LocalityComparisonService(db);
    const result = await service.compare({
      localityIds: payload.locality_ids || payload.localityIds || [],
      city: payload.city || config.DEFAULT_CITY,
      workplace: payload.workplace || payload.office || "Sector V, Salt Lake, Kolkata",
      preferences: payload.preferences || [],
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/localities/compare
localitiesRouter.get("/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const idsParam = (req.query.ids as string) || (req.query.locality_ids as string) || "";
    const localityIds = idsParam ? idsParam.split(",").map((s) => s.trim()) : [];
    const city = (req.query.city as string) || config.DEFAULT_CITY;
    const workplace = (req.query.workplace as string) || (req.query.office as string) || "Sector V, Salt Lake, Kolkata";

    const db = getDatabase();
    const service = new LocalityComparisonService(db);
    const result = await service.compare({
      localityIds,
      city,
      workplace,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/localities
localitiesRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const city = (req.query.city as string) || config.DEFAULT_CITY;
    const db = getDatabase();
    const repo = new LocalityRepository(db);
    const docs = await repo.topForCity(city);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/localities/:locality_id
localitiesRouter.get("/:locality_id", async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const repo = new LocalityRepository(db);
    const localityId = Array.isArray(req.params.locality_id)
      ? req.params.locality_id[0]
      : req.params.locality_id;
    const doc = await repo.get(localityId);
    if (!doc) {
      res.status(404).json({ detail: "Locality not found" });
      return;
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
