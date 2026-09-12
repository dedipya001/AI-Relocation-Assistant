"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bike, Car, Coffee, Footprints, LocateFixed, Train } from "lucide-react";
import { demoProperties } from "@/lib/demo-data";
import {
  buildFallbackIsochrones,
  COMMUTE_CONTOURS,
  estimateTravelMinutes,
  KOLKATA_METRO_GEOJSON,
  MAPBOX_PROFILE,
  pointInsideContour,
  type CommuteMode,
} from "@/lib/commute-map";
import type { Property } from "@/types";
import styles from "./relocation-map.module.css";

type RelocationMapProps = {
  properties?: Property[];
  activePropertyIndex?: number;
  officeCoordinates?: [number, number];
  officeLabel?: string;
  onMarkerClick?: (index: number) => void;
  onOfficeCoordinatesChange?: (coordinates: [number, number]) => void;
};

type OverlayKey = "cafe" | "transit";

const DEFAULT_OFFICE: [number, number] = [88.4335, 22.5762];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const CONTOUR_COLORS: Record<number, string> = {
  15: "#22c55e",
  30: "#f59e0b",
  45: "#ef4444",
};

const OSM_RASTER_STYLE: any = {
  version: 8,
  sources: {
    "carto-voyager": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
    },
  },
  layers: [
    {
      id: "carto-voyager-layer",
      type: "raster",
      source: "carto-voyager",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

let mapboxglCache: typeof import("mapbox-gl") | null = null;

async function fetchIsochrones(
  coords: [number, number],
  mode: CommuteMode
): Promise<any> {
  if (!MAPBOX_TOKEN || mode === "transit") {
    return buildFallbackIsochrones(coords, mode);
  }

  try {
    const profile = MAPBOX_PROFILE[mode];
    const response = await fetch(
      `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${coords[0]},${coords[1]}` +
        `?contours_minutes=15,30,45&polygons=true&denoise=1&generalize=80&access_token=${MAPBOX_TOKEN}`
    );
    if (!response.ok) return buildFallbackIsochrones(coords, mode);
    return response.json();
  } catch {
    return buildFallbackIsochrones(coords, mode);
  }
}

async function fetchRoute(
  from: [number, number],
  to: [number, number],
  mode: CommuteMode
): Promise<any> {
  if (!MAPBOX_TOKEN || mode === "transit") {
    return { type: "LineString", coordinates: [from, to] };
  }
  try {
    const profile = MAPBOX_PROFILE[mode];
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}` +
        `/${from[0]},${from[1]};${to[0]},${to[1]}` +
        `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.routes?.[0]?.geometry ?? null;
  } catch {
    return null;
  }
}

export function RelocationMap({
  properties,
  activePropertyIndex,
  officeCoordinates,
  officeLabel,
  onMarkerClick,
  onOfficeCoordinatesChange,
}: RelocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const mglRef = useRef<typeof import("mapbox-gl") | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const officeMarkerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const popupRef = useRef<import("mapbox-gl").Popup | null>(null);
  const routeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isoRequestId = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set(["transit"]));
  const [mode, setMode] = useState<CommuteMode>("transit");
  const [activeContour, setActiveContour] = useState<number>(30);
  const [filterWithinContour, setFilterWithinContour] = useState(false);
  const [officeAnchor, setOfficeAnchor] = useState<[number, number]>(officeCoordinates ?? DEFAULT_OFFICE);
  const [isochrones, setIsochrones] = useState<any>(() =>
    buildFallbackIsochrones(officeCoordinates ?? DEFAULT_OFFICE, "transit")
  );

  const officeStr = officeLabel?.trim() || "Office";
  const pins = useMemo(
    () =>
      (properties?.filter((property) => property.location?.coordinates) ?? demoProperties)
        .filter((property) => property.location?.coordinates)
        .slice(0, 40),
    [properties]
  );

  const moveOffice = useCallback(
    (coordinates: [number, number]) => {
      setOfficeAnchor(coordinates);
      onOfficeCoordinatesChange?.(coordinates);
    },
    [onOfficeCoordinatesChange]
  );

  useEffect(() => {
    if (!officeCoordinates) return;
    setOfficeAnchor((current) => {
      if (current[0] === officeCoordinates[0] && current[1] === officeCoordinates[1]) return current;
      return officeCoordinates;
    });
  }, [officeCoordinates]);

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setActiveOverlays((previous) => {
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void (async () => {
      if (!mapboxglCache) {
        mapboxglCache = await import("mapbox-gl");
        if (MAPBOX_TOKEN) mapboxglCache.default.accessToken = MAPBOX_TOKEN;
      }
      if (cancelled || !containerRef.current) return;

      const mgl = mapboxglCache;
      mglRef.current = mgl;
      const map = new mgl.default.Map({
        container: containerRef.current,
        style: MAPBOX_TOKEN ? "mapbox://styles/mapbox/light-v11" : OSM_RASTER_STYLE,
        center: officeAnchor,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mgl.default.NavigationControl({ visualizePitch: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        setMapReady(true);

        if (map.getLayer("poi-label")) {
          map.setLayoutProperty("poi-label", "visibility", "none");
        }
        if (map.getLayer("transit-label")) {
          map.setLayoutProperty("transit-label", "visibility", "none");
        }

        map.addSource("commute-isochrones", {
          type: "geojson",
          data: buildFallbackIsochrones(officeAnchor, mode),
        });

        [45, 30, 15].forEach((minutes) => {
          map.addLayer({
            id: `iso-fill-${minutes}`,
            type: "fill",
            source: "commute-isochrones",
            filter: ["==", ["get", "contour"], minutes],
            paint: {
              "fill-color": CONTOUR_COLORS[minutes],
              "fill-opacity": minutes === activeContour ? 0.16 : 0.08,
            },
          });
          map.addLayer({
            id: `iso-border-${minutes}`,
            type: "line",
            source: "commute-isochrones",
            filter: ["==", ["get", "contour"], minutes],
            paint: {
              "line-color": CONTOUR_COLORS[minutes],
              "line-width": minutes === activeContour ? 3 : 1.4,
              "line-opacity": 0.85,
              "line-dasharray": minutes === activeContour ? [1, 0] : [3, 2],
            },
          });
        });

        map.addSource("kolkata-metro", { type: "geojson", data: KOLKATA_METRO_GEOJSON });
        map.addLayer({
          id: "metro-lines",
          type: "line",
          source: "kolkata-metro",
          filter: ["==", ["get", "kind"], "line"],
          paint: {
            "line-color": ["match", ["get", "line"], "Green Line", "#16a34a", "Blue Line", "#2563eb", "#64748b"],
            "line-width": 3,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "metro-stations",
          type: "circle",
          source: "kolkata-metro",
          filter: ["==", ["get", "kind"], "station"],
          paint: {
            "circle-radius": 4.5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#111827",
            "circle-stroke-width": 1.5,
          },
        });

        map.addSource("route-src", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-bg",
          type: "line",
          source: "route-src",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#a5b4fc", "line-width": 5, "line-opacity": 0.3 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-src",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#4f46e5",
            "line-width": 3.2,
            "line-opacity": 0.92,
            "line-dasharray": [0, 4, 3],
          },
        });

        const officeElement = document.createElement("div");
        officeElement.className = styles.officeMarker;
        officeElement.innerHTML = `<span>${officeStr}</span><small>drag me</small>`;
        const officeMarker = new mgl.default.Marker({
          element: officeElement,
          anchor: "bottom",
          draggable: true,
        })
          .setLngLat(officeAnchor)
          .addTo(map);
        officeMarker.on("dragend", () => {
          const next = officeMarker.getLngLat();
          moveOffice([next.lng, next.lat]);
        });
        officeMarkerRef.current = officeMarker;

        map.on("click", (event) => {
          const target = event.originalEvent.target as HTMLElement | null;
          if (target?.closest?.(".mapboxgl-marker")) return;
          moveOffice([event.lngLat.lng, event.lngLat.lat]);
        });

        const counter = new Map<string, number>();
        const propertyMarkers: import("mapbox-gl").Marker[] = [];
        pins.forEach((property, index) => {
          const coordinates = property.location?.coordinates;
          if (!coordinates) return;
          const position = spreadDupe(coordinates, counter);
          const element = document.createElement("button");
          element.type = "button";
          element.className = styles.propertyMarker;
          element.setAttribute("aria-label", property.title);
          element.textContent = String(index + 1);
          element.addEventListener("click", () => onMarkerClick?.(index));
          const marker = new mgl.default.Marker({ element, anchor: "center" })
            .setLngLat(position)
            .addTo(map);
          propertyMarkers.push(marker);
        });
        markersRef.current = propertyMarkers;

        if (propertyMarkers.length > 0) {
          const bounds = new mgl.default.LngLatBounds(officeAnchor, officeAnchor);
          pins.forEach((property) => {
            if (property.location?.coordinates) bounds.extend(property.location.coordinates);
          });
          map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 450, right: 60 },
            maxZoom: 13,
            duration: 900,
          });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (routeTimer.current) clearInterval(routeTimer.current);
      routeTimer.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      officeMarkerRef.current?.remove();
      officeMarkerRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Map is recreated only when the result pin set or office label changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, officeStr]);

  useEffect(() => {
    const map = mapRef.current;
    officeMarkerRef.current?.setLngLat(officeAnchor);
    if (!map || !mapReady) return;

    const currentRequest = ++isoRequestId.current;
    const timer = window.setTimeout(() => {
      void fetchIsochrones(officeAnchor, mode).then((data) => {
        if (currentRequest !== isoRequestId.current || !mapRef.current) return;
        setIsochrones(data);
        try {
          (mapRef.current.getSource("commute-isochrones") as any)?.setData(data);
        } catch {}
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [officeAnchor, mode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    [15, 30, 45].forEach((minutes) => {
      if (map.getLayer(`iso-fill-${minutes}`)) {
        map.setPaintProperty(`iso-fill-${minutes}`, "fill-opacity", minutes === activeContour ? 0.16 : 0.08);
      }
      if (map.getLayer(`iso-border-${minutes}`)) {
        map.setPaintProperty(`iso-border-${minutes}`, "line-width", minutes === activeContour ? 3 : 1.4);
        map.setPaintProperty(`iso-border-${minutes}`, "line-dasharray", minutes === activeContour ? [1, 0] : [3, 2]);
      }
    });
  }, [activeContour, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const visible = activeOverlays.has("transit") ? "visible" : "none";
    if (map.getLayer("metro-lines")) map.setLayoutProperty("metro-lines", "visibility", visible);
    if (map.getLayer("metro-stations")) map.setLayoutProperty("metro-stations", "visibility", visible);
    if (map.getLayer("transit-label")) map.setLayoutProperty("transit-label", "visibility", visible);
    if (map.getLayer("poi-label")) {
      map.setLayoutProperty("poi-label", "visibility", activeOverlays.has("cafe") ? "visible" : "none");
    }
  }, [activeOverlays, mapReady]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      const coordinates = pins[index]?.location?.coordinates;
      const inside =
        !filterWithinContour ||
        !coordinates ||
        pointInsideContour(coordinates, isochrones, activeContour);
      marker.getElement().style.display = inside ? "" : "none";
      if (coordinates) {
        const minutes = estimateTravelMinutes(officeAnchor, coordinates, mode);
        marker.getElement().title = `Approx. ${minutes} min by ${mode}`;
      }
    });
  }, [pins, filterWithinContour, isochrones, activeContour, officeAnchor, mode]);

  useEffect(() => {
    if (activePropertyIndex === undefined || activePropertyIndex === null) return;
    const map = mapRef.current;
    const mgl = mglRef.current;
    const property = pins[activePropertyIndex];
    const coordinates = property?.location?.coordinates;
    if (!map || !mgl || !coordinates || !mapReady) return;

    const counter = new Map<string, number>();
    pins.slice(0, activePropertyIndex).forEach((pin) => {
      if (pin.location?.coordinates) spreadDupe(pin.location.coordinates, counter);
    });
    const position = spreadDupe(coordinates, counter);

    popupRef.current?.remove();
    markersRef.current.forEach((marker, index) =>
      marker.getElement().classList.toggle(styles.activeMarker, index === activePropertyIndex)
    );

    const draw = async () => {
      if (routeTimer.current) clearInterval(routeTimer.current);
      routeTimer.current = null;
      try {
        (map.getSource("route-src") as any)?.setData({ type: "FeatureCollection", features: [] });
      } catch {}

      map.flyTo({ center: position, zoom: 14, duration: 700, essential: true });
      const geometry = await fetchRoute(officeAnchor, position, mode);
      if (!geometry || !mapRef.current) return;

      try {
        (mapRef.current.getSource("route-src") as any)?.setData({
          type: "Feature",
          properties: { mode },
          geometry,
        });
        const dash = [[0, 4, 3], [0.8, 4, 3], [1.6, 4, 3], [2.4, 4, 3], [3.2, 4, 3]];
        let step = 0;
        routeTimer.current = setInterval(() => {
          if (!mapRef.current?.getLayer("route-line")) return;
          try {
            mapRef.current.setPaintProperty("route-line", "line-dasharray", dash[step % dash.length]);
          } catch {}
          step += 1;
        }, 110);
      } catch {}

      const popup = new mgl.default.Popup({
        closeButton: false,
        offset: 20,
        className: "relo-popup",
        maxWidth: "270px",
      })
        .setHTML(renderPopup(property, activePropertyIndex, officeAnchor, mode))
        .setLngLat(position)
        .addTo(map);
      popupRef.current = popup;
    };

    void draw();
    return () => {
      if (routeTimer.current) clearInterval(routeTimer.current);
      routeTimer.current = null;
    };
  }, [activePropertyIndex, mapReady, pins, officeAnchor, mode]);

  const modeOptions: Array<{ key: CommuteMode; label: string; icon: React.ReactNode }> = [
    { key: "transit", label: "Metro", icon: <Train size={13} /> },
    { key: "driving", label: "Drive", icon: <Car size={13} /> },
    { key: "cycling", label: "Cycle", icon: <Bike size={13} /> },
    { key: "walking", label: "Walk", icon: <Footprints size={13} /> },
  ];

  return (
    <div className={styles.mapCard}>
      <div ref={containerRef} className={styles.mapCanvas} />

      <div className={styles.commuteControls}>
        <div className={styles.modeRow} aria-label="Commute mode">
          {modeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.modeBtn} ${mode === option.key ? styles.modeBtnOn : ""}`}
              onClick={() => setMode(option.key)}
              title={`Show ${option.label.toLowerCase()} travel-time contours`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.contourRow} aria-label="Active commute contour">
          {COMMUTE_CONTOURS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`${styles.contourBtn} ${activeContour === minutes ? styles.contourBtnOn : ""}`}
              onClick={() => setActiveContour(minutes)}
            >
              <span className={styles.contourSwatch} style={{ background: CONTOUR_COLORS[minutes] }} />
              {minutes} min
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.withinBtn} ${filterWithinContour ? styles.withinBtnOn : ""}`}
          onClick={() => setFilterWithinContour((value) => !value)}
        >
          <LocateFixed size={14} />
          {filterWithinContour ? `Showing inside ${activeContour} min` : `Filter inside ${activeContour} min`}
        </button>
        <p className={styles.officeHint}>Drag the office pin or click the map to recalculate.</p>
      </div>

      <div className={styles.overlayControls}>
        <button
          type="button"
          className={`${styles.overlayBtn} ${activeOverlays.has("cafe") ? styles.overlayBtnOn : ""}`}
          onClick={() => toggleOverlay("cafe")}
          title="Show cafés and restaurants"
        >
          <Coffee size={13} />
          <span>Cafés</span>
        </button>
        <button
          type="button"
          className={`${styles.overlayBtn} ${activeOverlays.has("transit") ? styles.overlayBtnOn : ""}`}
          onClick={() => toggleOverlay("transit")}
          title="Show Kolkata Green and Blue metro lines"
        >
          <Train size={13} />
          <span>Metro lines</span>
        </button>
      </div>

      {mapReady && (
        <div className={styles.ringLegend}>
          <p className={styles.ringTitle}>{mode} from office</p>
          <div className={styles.ringItems}>
            {COMMUTE_CONTOURS.map((minutes) => (
              <span key={minutes} className={styles.ringItem}>
                <span className={styles.ringDot} style={{ background: CONTOUR_COLORS[minutes] }} />
                {minutes} min
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderPopup(
  property: Property,
  index: number,
  office: [number, number],
  mode: CommuteMode
) {
  const priceK = Math.round(property.rent / 1000);
  const locality = [property.locality, property.city].filter(Boolean).join(", ");
  const coordinates = property.location?.coordinates;
  const minutes = coordinates ? estimateTravelMinutes(office, coordinates, mode) : property.commute_estimate_minutes;
  const commute = minutes
    ? `<span class="relo-popup-tag relo-popup-tag-commute">⏱ ~${minutes} min ${mode}</span>`
    : "";
  const distance =
    typeof property.distance_to_office_km === "number"
      ? `<span class="relo-popup-tag">📍 ${property.distance_to_office_km.toFixed(1)} km</span>`
      : "";
  return `
    <div class="relo-popup-inner">
      <div class="relo-popup-header">
        <span class="relo-popup-num">${index + 1}</span>
        <span class="relo-popup-locality">${locality || property.title}</span>
      </div>
      <div class="relo-popup-price">₹${priceK}k<span style="font-size:0.65rem;font-weight:500;color:#6e7d96">/mo</span></div>
      <div class="relo-popup-tags">${commute}${distance}</div>
    </div>`;
}

function spreadDupe(
  coordinates: [number, number],
  counter: Map<string, number>
): [number, number] {
  const [lon, lat] = coordinates;
  const key = `${lon.toFixed(5)}:${lat.toFixed(5)}`;
  const index = counter.get(key) ?? 0;
  counter.set(key, index + 1);
  if (index === 0) return [lon, lat];
  const angle = index * 137.5;
  const radius = Math.min(0.012, 0.0022 * index);
  const radians = (angle * Math.PI) / 180;
  const latOffset = radius * Math.sin(radians);
  const lonOffset = (radius * Math.cos(radians)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [lon + lonOffset, lat + latOffset];
}
