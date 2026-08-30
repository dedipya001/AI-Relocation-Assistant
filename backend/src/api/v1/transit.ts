import { Router, Request, Response } from "express";
import { TransitAndLifestyleService } from "../../services/transitAndLifestyleService.js";

export const transitRouter = Router();
const service = new TransitAndLifestyleService();

// GET /api/v1/transit/metro
transitRouter.get("/metro", (req: Request, res: Response): void => {
  try {
    const city = req.query.city as string | undefined;
    const lines = service.getMetroLines(city);
    res.json({
      city: city || "All Cities",
      total_lines: lines.length,
      lines,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/transit/bus
transitRouter.get("/bus", (req: Request, res: Response): void => {
  try {
    const city = req.query.city as string | undefined;
    const query = (req.query.q as string) || (req.query.query as string) || undefined;
    const routes = service.getBusRoutes(city, query);
    res.json({
      city: city || "All Cities",
      total_routes: routes.length,
      routes,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/transit/lifestyle
transitRouter.get("/lifestyle", (req: Request, res: Response): void => {
  try {
    const city = req.query.city as string | undefined;
    const localityId = (req.query.locality_id as string) || (req.query.localityId as string) || undefined;
    const localityName = (req.query.locality as string) || (req.query.locality_name as string) || undefined;
    const category = req.query.category as any;

    const venues = service.getLifestyle({
      city,
      localityId,
      localityName,
      category,
    });

    res.json({
      city: city || "All Cities",
      locality: localityName || localityId || "All",
      total_venues: venues.length,
      venues,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/transit/hubs (find nearest metro, bus, cafes, clubs from coords or locality)
transitRouter.post("/hubs", (req: Request, res: Response): void => {
  try {
    const { coordinates, max_radius_km } = req.body || {};
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      res.status(400).json({ error: "Missing valid coordinates [longitude, latitude]" });
      return;
    }

    const hubs = service.findNearestHubs(
      coordinates[0],
      coordinates[1],
      max_radius_km ? Number(max_radius_km) : 10.0
    );

    res.json({
      query_coordinates: coordinates,
      ...hubs,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
