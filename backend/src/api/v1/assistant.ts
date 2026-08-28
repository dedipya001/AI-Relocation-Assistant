import { Router, Request, Response } from "express";
import { getDatabase } from "../../db/mongo.js";
import { LocalityRepository } from "../../repositories/localities.js";
import { PropertyRepository } from "../../repositories/properties.js";
import { IntentParser } from "../../services/intentParser.js";
import { LowestPriceEngine } from "../../services/lowestPrice.js";
import { RecommendationEngine } from "../../services/recommendations.js";
import {
  keepNearbyRelocationOptions,
  rankByOfficeProximity,
  resolveOfficeCoordinates,
} from "./search.js";

export const assistantRouter = Router();

// POST /api/v1/assistant/chat
assistantRouter.post("/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const message = req.body?.message || "";
    const db = getDatabase();
    const propertyRepo = new PropertyRepository(db);
    const localityRepo = new LocalityRepository(db);

    const intent = await new IntentParser().parse(message);
    let properties = await propertyRepo.search(intent.filters);

    const officeCoordinates = intent.filters.office_location
      ? await resolveOfficeCoordinates(intent.filters.office_location)
      : null;

    if (officeCoordinates) {
      rankByOfficeProximity(properties, officeCoordinates);
      properties = keepNearbyRelocationOptions(properties);
    }

    const localityIds = Array.from(new Set(properties.map((p) => p.locality_id).filter(Boolean)));
    const localities =
      localityIds.length > 0
        ? await localityRepo.list({ _id: { $in: localityIds } } as any, 50)
        : [];

    const localitiesById: Record<string, any> = {};
    for (const loc of localities) {
      localitiesById[String(loc._id)] = loc;
    }

    const priceEngine = new LowestPriceEngine();
    const enriched = properties.map((prop) => priceEngine.attachLowestPrice(prop));

    const recommendations = new RecommendationEngine().rank(
      enriched,
      localitiesById,
      intent.filters.preferences,
      intent.filters.budget_max
    );

    const searchResult = {
      intent,
      office_coordinates: officeCoordinates ? [officeCoordinates[0], officeCoordinates[1]] : null,
      recommendations,
      properties: enriched,
    };

    const top = recommendations.slice(0, 3);
    let answer: string;
    if (top.length === 0) {
      answer =
        "I need a little more detail to recommend areas. Share office location, budget, commute preference, and must-haves.";
    } else {
      const names = top.map((item) => item.title).join(", ");
      answer = `I found ${top.length} strong options: ${names}. I ranked them by commute, affordability, safety, internet, and lifestyle fit.`;
    }

    res.json({ answer, context: searchResult });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
