import { Router, Request, Response } from "express";
import { getDatabase } from "../../db/mongo.js";
import { PropertySearchFilters } from "../../models/property.js";
import { PropertyRepository } from "../../repositories/properties.js";
import { LowestPriceEngine } from "../../services/lowestPrice.js";
import { OpenPropertyDataService } from "../../services/openPropertyData.js";
import { PropertyAggregationService } from "../../services/propertyAggregation.js";

export const propertiesRouter = Router();

// GET /api/v1/properties
propertiesRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const budgetMax = req.query.budget_max ? parseInt(req.query.budget_max as string, 10) : undefined;
    const rawTypes = req.query.property_type;
    const propertyTypes: string[] = Array.isArray(rawTypes)
      ? (rawTypes as string[])
      : typeof rawTypes === "string"
      ? [rawTypes]
      : [];

    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 40;

    const filters: PropertySearchFilters = {
      city,
      budget_max: budgetMax,
      property_types: propertyTypes,
      locality_ids: [],
      amenities: [],
      transport_modes: [],
      preferences: [],
    };

    const db = getDatabase();
    const repo = new PropertyRepository(db);
    const docs = await repo.search(filters, limit);
    const priceEngine = new LowestPriceEngine();
    const results = docs.map((doc) => priceEngine.attachLowestPrice(doc));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/properties/open-data
propertiesRouter.get("/open-data", async (req: Request, res: Response): Promise<void> => {
  try {
    const place = (req.query.place as string) || "Sector V Kolkata";
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "25", 10), 1), 80);
    const rawSources = req.query.sources;
    const sources: string[] = Array.isArray(rawSources)
      ? (rawSources as string[])
      : typeof rawSources === "string"
      ? [rawSources]
      : [];

    const results = await new OpenPropertyDataService().fetchPropertyLeads(place, limit, sources);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/properties/open-data/sources
propertiesRouter.get("/open-data/sources", (_req: Request, res: Response): void => {
  res.json(new OpenPropertyDataService().availableSources());
});

// GET /api/v1/properties/aggregate
propertiesRouter.get("/aggregate", async (req: Request, res: Response): Promise<void> => {
  try {
    const place = (req.query.place as string) || "Sector V Kolkata";
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "40", 10), 1), 120);
    const rawSources = req.query.sources;
    const sources: string[] = Array.isArray(rawSources)
      ? (rawSources as string[])
      : typeof rawSources === "string"
      ? [rawSources]
      : [];

    const results = await new PropertyAggregationService().aggregate(place, limit, sources);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/properties/aggregate/sources
propertiesRouter.get("/aggregate/sources", (_req: Request, res: Response): void => {
  res.json(new PropertyAggregationService().sources());
});

// GET /api/v1/properties/:property_id
propertiesRouter.get("/:property_id", async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const repo = new PropertyRepository(db);
    const propertyId = Array.isArray(req.params.property_id)
      ? req.params.property_id[0]
      : req.params.property_id;
    const doc = await repo.get(propertyId);
    if (!doc) {
      res.status(404).json({ detail: "Property not found" });
      return;
    }
    const priceEngine = new LowestPriceEngine();
    res.json(priceEngine.attachLowestPrice(doc));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/properties/cost-breakdown
propertiesRouter.post("/cost-breakdown", async (req: Request, res: Response): Promise<void> => {
  try {
    const { moveInCostService } = await import("../../services/moveInCostService.js");
    const { title, city, locality, property_type, rent, deposit, source_platform, source_url, price_history } = req.body || {};

    if (!rent || rent <= 0) {
      res.status(400).json({ error: "Missing required positive rent amount" });
      return;
    }

    const breakdown = moveInCostService.calculateCostBreakdown({
      title: title || "Rental Property",
      city: city || "Kolkata",
      locality: locality || "Locality",
      property_type: property_type || "PG",
      rent: Number(rent),
      deposit: deposit ? Number(deposit) : undefined,
      source_platform,
      source_url,
      price_history,
    });

    res.json(breakdown);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/properties/:property_id/cost-breakdown
propertiesRouter.get("/:property_id/cost-breakdown", async (req: Request, res: Response): Promise<void> => {
  try {
    const { moveInCostService } = await import("../../services/moveInCostService.js");
    const db = getDatabase();
    const repo = new PropertyRepository(db);
    const propertyId = Array.isArray(req.params.property_id)
      ? req.params.property_id[0]
      : req.params.property_id;
    const doc = await repo.get(propertyId);
    if (!doc) {
      res.status(404).json({ detail: "Property not found" });
      return;
    }

    const breakdown = moveInCostService.calculateCostBreakdown(doc);
    res.json(breakdown);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

