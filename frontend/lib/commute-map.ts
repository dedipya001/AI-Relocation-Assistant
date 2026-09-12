export type CommuteMode = "transit" | "driving" | "cycling" | "walking";

export const COMMUTE_CONTOURS = [15, 30, 45] as const;

const MODE_SPEED_KM_PER_MINUTE: Record<CommuteMode, number> = {
  transit: 0.34,
  driving: 0.42,
  cycling: 0.22,
  walking: 0.078,
};

export const MAPBOX_PROFILE: Record<Exclude<CommuteMode, "transit">, string> = {
  driving: "driving",
  cycling: "cycling",
  walking: "walking",
};

export function haversineKm(a: [number, number], b: [number, number]): number {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateTravelMinutes(
  from: [number, number],
  to: [number, number],
  mode: CommuteMode
): number {
  const straightLineKm = haversineKm(from, to);
  const networkFactor = mode === "walking" ? 1.12 : mode === "cycling" ? 1.18 : 1.28;
  return Math.max(1, Math.round((straightLineKm * networkFactor) / MODE_SPEED_KM_PER_MINUTE[mode]));
}

function destinationPoint(
  center: [number, number],
  distanceKm: number,
  bearingDegrees: number
): [number, number] {
  const earthRadiusKm = 6371;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (center[1] * Math.PI) / 180;
  const lng1 = (center[0] * Math.PI) / 180;
  const angularDistance = distanceKm / earthRadiusKm;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export function buildFallbackIsochrones(
  center: [number, number],
  mode: CommuteMode
): any {
  const features = [...COMMUTE_CONTOURS]
    .reverse()
    .map((minutes) => {
      const radiusKm = MODE_SPEED_KM_PER_MINUTE[mode] * minutes;
      const ring: [number, number][] = [];
      for (let bearing = 0; bearing <= 360; bearing += 6) {
        ring.push(destinationPoint(center, radiusKm, bearing));
      }
      return {
        type: "Feature",
        properties: { contour: minutes, mode, generated: "fallback" },
        geometry: { type: "Polygon", coordinates: [ring] },
      };
    });

  return { type: "FeatureCollection", features };
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInsideContour(
  point: [number, number],
  featureCollection: any,
  contourMinutes: number
): boolean {
  const feature = featureCollection?.features?.find(
    (item: any) => Number(item?.properties?.contour) === contourMinutes
  );
  const geometry = feature?.geometry;
  if (!geometry) return true;

  if (geometry.type === "Polygon") {
    return pointInRing(point, geometry.coordinates?.[0] ?? []);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates ?? []).some((polygon: [number, number][][]) =>
      pointInRing(point, polygon?.[0] ?? [])
    );
  }
  return true;
}

export const KOLKATA_METRO_GEOJSON: any = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { kind: "line", line: "Green Line", label: "East-West Metro" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3055, 22.5835],
          [88.3427, 22.5838],
          [88.3526, 22.5647],
          [88.3714, 22.5677],
          [88.3897, 22.5735],
          [88.4092, 22.5812],
          [88.4195, 22.579],
          [88.423, 22.5902],
          [88.4299, 22.586],
          [88.4335, 22.5762]
        ]
      }
    },
    {
      type: "Feature",
      properties: { kind: "line", line: "Blue Line", label: "North-South Metro" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3574, 22.6554],
          [88.393, 22.6214],
          [88.3735, 22.6014],
          [88.3608, 22.5829],
          [88.3526, 22.5647],
          [88.351, 22.5542],
          [88.346, 22.5165],
          [88.346, 22.493],
          [88.395, 22.469]
        ]
      }
    },
    ...[
      ["Howrah Maidan", "Green Line", 88.3055, 22.5835],
      ["Howrah", "Green Line", 88.3427, 22.5838],
      ["Esplanade", "Green/Blue Interchange", 88.3526, 22.5647],
      ["Sealdah", "Green Line", 88.3714, 22.5677],
      ["Salt Lake Stadium", "Green Line", 88.4092, 22.5812],
      ["Karunamoyee", "Green Line", 88.4299, 22.586],
      ["Salt Lake Sector V", "Green Line", 88.4335, 22.5762],
      ["Dakshineswar", "Blue Line", 88.3574, 22.6554],
      ["Dum Dum", "Blue Line", 88.393, 22.6214],
      ["Shyambazar", "Blue Line", 88.3735, 22.6014],
      ["Park Street", "Blue Line", 88.351, 22.5542],
      ["Kalighat", "Blue Line", 88.346, 22.5165],
      ["Kavi Subhash", "Blue Line", 88.395, 22.469]
    ].map(([name, line, lng, lat]) => ({
      type: "Feature",
      properties: { kind: "station", name, line },
      geometry: { type: "Point", coordinates: [lng, lat] }
    }))
  ]
};
