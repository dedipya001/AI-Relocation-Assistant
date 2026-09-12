import { Router, Request, Response } from "express";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";
import { LocalityComparisonService } from "../../services/localityComparison.js";
import { resolveOfficeCoordinates } from "./search.js";

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

// GET /api/v1/localities/compare?localities=id1,id2&workplace=Sector%20V
localitiesRouter.get("/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = String(req.query.localities || req.query.locality_ids || "");
    const localityRefs = raw.split(",").map((value) => value.trim()).filter(Boolean);
    const workplace = String(req.query.workplace || req.query.office_location || config.DEFAULT_OFFICE_HINT);
    if (localityRefs.length < 2 || localityRefs.length > 4) {
      res.status(400).json({ error: "Provide 2 to 4 comma-separated localities." });
      return;
    }
    const workplaceCoordinates = await resolveOfficeCoordinates(workplace);
    if (!workplaceCoordinates) {
      res.status(400).json({ error: `Unable to resolve workplace location: ${workplace}` });
      return;
    }
    const result = await new LocalityComparisonService(getDatabase()).compare(
      localityRefs,
      workplace,
      workplaceCoordinates
    );
    res.json(result);
  } catch (error) {
    const message = (error as Error).message;
    res.status(/not found|2 and 4/i.test(message) ? 400 : 500).json({ error: message });
  }
});

// POST /api/v1/localities/compare
localitiesRouter.post("/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const localityRefs = Array.isArray(req.body?.localities)
      ? req.body.localities.map(String)
      : Array.isArray(req.body?.locality_ids)
        ? req.body.locality_ids.map(String)
        : [];
    const workplace = String(req.body?.workplace || req.body?.office_location || config.DEFAULT_OFFICE_HINT);
    if (localityRefs.length < 2 || localityRefs.length > 4) {
      res.status(400).json({ error: "Provide 2 to 4 localities." });
      return;
    }
    const suppliedCoordinates = req.body?.workplace_coordinates;
    const workplaceCoordinates: [number, number] | null =
      Array.isArray(suppliedCoordinates) && suppliedCoordinates.length >= 2
        ? [Number(suppliedCoordinates[0]), Number(suppliedCoordinates[1])]
        : await resolveOfficeCoordinates(workplace);
    if (!workplaceCoordinates || !workplaceCoordinates.every(Number.isFinite)) {
      res.status(400).json({ error: `Unable to resolve workplace location: ${workplace}` });
      return;
    }
    const result = await new LocalityComparisonService(getDatabase()).compare(
      localityRefs,
      workplace,
      workplaceCoordinates
    );
    res.json(result);
  } catch (error) {
    const message = (error as Error).message;
    res.status(/not found|2 and 4/i.test(message) ? 400 : 500).json({ error: message });
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
