import { Router, Request, Response } from "express";
import { getDatabase } from "../../db/mongo.js";
import {
  NegotiatedRentInSchema,
  UserFeedbackInSchema,
} from "../../models/feedback.js";
import { serializeDoc } from "../../repositories/base.js";
import { emailService } from "../../services/emailService.js";

export const feedbackRouter = Router();

// POST /api/v1/feedback/negotiated-rents
feedbackRouter.post("/negotiated-rents", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = NegotiatedRentInSchema.parse(req.body);
    const db = getDatabase();
    const doc = {
      ...parsed,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("negotiated_rents").insertOne(doc);

    // Notify admin email asynchronously
    emailService.sendNegotiatedRentAlert({
      property_id: parsed.property_id,
      original_rent: parsed.original_rent,
      negotiated_rent: parsed.negotiated_rent,
      notes: parsed.notes,
    }).catch(() => {});

    res.json(serializeDoc({ ...doc, _id: result.insertedId }));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/v1/feedback/locality
feedbackRouter.post("/locality", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = UserFeedbackInSchema.parse(req.body);
    const db = getDatabase();
    const doc = {
      ...parsed,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("user_feedback").insertOne(doc);

    // Notify admin email asynchronously
    emailService.sendLocalityFeedbackAlert({
      locality_id: parsed.locality_id,
      score: parsed.score,
      comment: parsed.comment,
    }).catch(() => {});

    res.json(serializeDoc({ ...doc, _id: result.insertedId }));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

