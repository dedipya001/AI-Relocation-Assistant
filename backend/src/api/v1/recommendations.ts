import { Request, Response, Router } from "express";
import { getDatabase } from "../../db/mongo.js";
import { RankRequestSchema } from "../../models/ai.js";
import { LocalityRepository } from "../../repositories/localities.js";
import {
  RecommendationEngine,
  SCORING_PROFILE_PRESETS,
} from "../../services/recommendations.js";

export const recommendationsRouter = Router();

// GET /api/v1/recommendations/profiles
recommendationsRouter.get("/profiles", (_req: Request, res: Response): void => {
  res.json({
    profiles: Object.keys(SCORING_PROFILE_PRESETS),
    presets: SCORING_PROFILE_PRESETS,
  });
});

// POST /api/v1/recommendations/rank
recommendationsRouter.post("/rank", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = RankRequestSchema.parse(req.body);
    let localitiesById = parsed.localities_by_id || {};

    // If localities are not provided, auto-fetch from DB based on locality_ids
    if (Object.keys(localitiesById).length === 0 && parsed.properties.length > 0) {
      const localityIds = Array.from(
        new Set(parsed.properties.map((p) => p.locality_id).filter(Boolean))
      );
      if (localityIds.length > 0) {
        const db = getDatabase();
        const repo = new LocalityRepository(db);
        const docs = await repo.list({ _id: { $in: localityIds } } as any, 50);
        for (const doc of docs) {
          localitiesById[String(doc._id)] = doc;
        }
      }
    }

    const engine = new RecommendationEngine();
    const ranked = engine.rank(
      parsed.properties,
      localitiesById,
      parsed.preferences,
      parsed.budget_max,
      {
        profile: parsed.profile,
        customWeights: parsed.weights as any,
        hardConstraints: parsed.hard_constraints,
        preferences: parsed.preferences,
        budgetMax: parsed.budget_max,
      }
    );

    res.json({
      profile: parsed.profile || "balanced",
      weights: engine.normalizeWeights({
        ...(SCORING_PROFILE_PRESETS[parsed.profile || "balanced"] || SCORING_PROFILE_PRESETS.balanced),
        ...(parsed.weights || {}),
      } as any),
      hard_constraints: parsed.hard_constraints || null,
      total_candidates: parsed.properties.length,
      recommendations: ranked,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
