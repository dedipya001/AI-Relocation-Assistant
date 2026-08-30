import { Router, Request, Response } from "express";
import { regionBoundaryService } from "../../services/regionBoundaryService.js";

export const geoRouter = Router();

/**
 * GET /api/v1/geo/boundary
 * Retrieves verified GIS boundary, centroid, and bounding box from OpenStreetMap / Mapbox / Benchmarks.
 * Query params: region (or q), city
 */
geoRouter.get("/boundary", async (req: Request, res: Response): Promise<void> => {
  try {
    const region = (req.query.region as string) || (req.query.q as string) || "";
    const city = (req.query.city as string) || undefined;

    if (!region.trim()) {
      res.status(400).json({ error: "Missing required query parameter: region or q" });
      return;
    }

    const boundary = await regionBoundaryService.getVerifiedBoundary(region.trim(), city);
    if (!boundary) {
      res.status(404).json({ error: `No verified boundary found for region: '${region}'` });
      return;
    }

    res.json({
      success: true,
      boundary,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v1/geo/verify-boundary
 * Checks if a given coordinate point [longitude, latitude] falls inside a region boundary.
 */
geoRouter.post("/verify-boundary", async (req: Request, res: Response): Promise<void> => {
  try {
    const { region, city, coordinates, tolerance_km } = req.body || {};

    if (!region || !Array.isArray(coordinates) || coordinates.length < 2) {
      res.status(400).json({
        error: "Missing required fields: region (string) and coordinates [lon, lat]",
      });
      return;
    }

    const boundary = await regionBoundaryService.getVerifiedBoundary(region, city);
    if (!boundary) {
      res.status(404).json({ error: `No verified boundary found for region: '${region}'` });
      return;
    }

    const verification = regionBoundaryService.isInsideBoundary(
      [Number(coordinates[0]), Number(coordinates[1])],
      boundary,
      tolerance_km || 0.8
    );

    res.json({
      region: boundary.region_name,
      city: boundary.city,
      coordinates,
      boundary_bounding_box: boundary.bounding_box,
      boundary_centroid: boundary.centroid,
      boundary_radius_km: boundary.boundary_radius_km,
      source: boundary.source,
      ...verification,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v1/geo/resolve
 * Standardized endpoint to resolve any user locality into a VerifiedLocationObject
 */
geoRouter.get("/resolve", async (req: Request, res: Response): Promise<void> => {
  try {
    const { localityResolutionService } = await import("../../services/localityResolutionService.js");
    const query = (req.query.q as string) || (req.query.locality as string) || "";
    const city = (req.query.city as string) || undefined;

    if (!query.trim()) {
      res.status(400).json({ error: "Missing required query parameter: q or locality" });
      return;
    }

    const location = await localityResolutionService.resolveLocality(query.trim(), city);
    if (!location) {
      res.status(404).json({ error: `Locality '${query}' could not be verified` });
      return;
    }

    res.json({
      success: true,
      location,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v1/geo/reverse-geocode
 * Reverse-geocodes coordinate point [lon, lat] into real locality and city
 */
geoRouter.post("/reverse-geocode", async (req: Request, res: Response): Promise<void> => {
  try {
    const { localityResolutionService } = await import("../../services/localityResolutionService.js");
    const { coordinates } = req.body || {};

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      res.status(400).json({ error: "Missing valid coordinates array [longitude, latitude]" });
      return;
    }

    const reversed = await localityResolutionService.reverseGeocode(
      Number(coordinates[0]),
      Number(coordinates[1])
    );

    res.json({
      success: true,
      coordinates,
      locality: reversed?.locality || "Unknown Locality",
      city: reversed?.city || "Unknown City",
      subLocality: reversed?.subLocality,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
