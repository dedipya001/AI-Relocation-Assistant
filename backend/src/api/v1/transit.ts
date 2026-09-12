import { Request, Response, Router } from "express";
import { NetworkStatus } from "../../data/transitAndLifestyle.js";
import { TransitAndLifestyleService } from "../../services/transitAndLifestyleService.js";

export const transitRouter = Router();

function numberParam(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function queryOptions(req: Request) {
  return {
    city: typeof req.query.city === "string" ? req.query.city : null,
    lat: numberParam(req.query.lat),
    lon: numberParam(req.query.lon),
    limit: numberParam(req.query.limit) ?? 10,
  };
}

function invalidCoordinates(req: Request) {
  const latProvided = req.query.lat !== undefined;
  const lonProvided = req.query.lon !== undefined;
  if (latProvided !== lonProvided) return true;
  if (!latProvided && !lonProvided) return false;
  const lat = numberParam(req.query.lat);
  const lon = numberParam(req.query.lon);
  return lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180;
}

transitRouter.get("/metro", (req: Request, res: Response): void => {
  if (invalidCoordinates(req)) {
    res.status(400).json({ error: "Provide valid lat/lon together." });
    return;
  }
  const status = typeof req.query.status === "string" ? (req.query.status as NetworkStatus) : null;
  res.json(new TransitAndLifestyleService().listMetro({ ...queryOptions(req), status }));
});

transitRouter.get("/bus", (req: Request, res: Response): void => {
  if (invalidCoordinates(req)) {
    res.status(400).json({ error: "Provide valid lat/lon together." });
    return;
  }
  res.json(new TransitAndLifestyleService().listBus(queryOptions(req)));
});

transitRouter.get("/lifestyle", (req: Request, res: Response): void => {
  if (invalidCoordinates(req)) {
    res.status(400).json({ error: "Provide valid lat/lon together." });
    return;
  }
  res.json(new TransitAndLifestyleService().listLifestyle(queryOptions(req)));
});

transitRouter.get("/hubs", (req: Request, res: Response): void => {
  if (invalidCoordinates(req)) {
    res.status(400).json({ error: "Provide valid lat/lon together." });
    return;
  }
  res.json(new TransitAndLifestyleService().listHubs(queryOptions(req)));
});
