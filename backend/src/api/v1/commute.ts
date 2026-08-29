import { Router, Request, Response } from "express";
import { CommuteService } from "../../services/commute.js";
import { resolveOfficeCoordinates } from "./search.js";

export const commuteRouter = Router();

// POST /api/v1/commute/estimate
commuteRouter.post("/estimate", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const origin = payload.origin || "Selected locality";
    const destination = payload.destination || "Office";
    const city = payload.city || "Kolkata";
    const modes = payload.modes;

    let originCoords = payload.origin_coordinates || null;
    let destCoords = payload.destination_coordinates || null;

    if (!originCoords && origin) {
      originCoords = await resolveOfficeCoordinates(origin, city);
    }
    if (!destCoords && destination) {
      destCoords = await resolveOfficeCoordinates(destination, city);
    }

    const service = new CommuteService();
    const detailed = await service.estimateDetailed({
      originName: origin,
      destinationName: destination,
      originCoords,
      destCoords,
      city,
      modes,
    });

    // If client requested legacy flat array format, return estimates, otherwise rich response
    if (req.query?.format === "legacy") {
      res.json(detailed.estimates);
      return;
    }

    res.json(detailed.estimates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/commute/traffic
commuteRouter.post("/traffic", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const origin = payload.origin || "Origin";
    const destination = payload.destination || "Destination";
    const city = payload.city || "Kolkata";

    let originCoords = payload.origin_coordinates || null;
    let destCoords = payload.destination_coordinates || null;

    if (!originCoords && origin) {
      originCoords = await resolveOfficeCoordinates(origin, city);
    }
    if (!destCoords && destination) {
      destCoords = await resolveOfficeCoordinates(destination, city);
    }

    const service = new CommuteService();
    const detailed = await service.estimateDetailed({
      originName: origin,
      destinationName: destination,
      originCoords,
      destCoords,
      city,
      modes: payload.modes,
    });

    res.json({
      origin,
      destination,
      city,
      origin_coordinates: originCoords,
      destination_coordinates: destCoords,
      aerial_distance_km: detailed.distance_km,
      road_distance_km: detailed.road_distance_km,
      traffic_data: detailed.traffic_data,
      mode_estimates: detailed.estimates,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
