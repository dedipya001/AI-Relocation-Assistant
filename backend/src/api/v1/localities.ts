import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";

export const localitiesRouter = Router();

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
