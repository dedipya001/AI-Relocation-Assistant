"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Coffee, Train } from "lucide-react";
import { demoProperties } from "@/lib/demo-data";
import type { Property } from "@/types";
import styles from "./relocation-map.module.css";

type RelocationMapProps = {
  properties?: Property[];
  activePropertyIndex?: number;
  officeCoordinates?: [number, number];
  officeLabel?: string;
  onMarkerClick?: (index: number) => void;
};

type OverlayKey = "cafe" | "transit";

const DEFAULT_OFFICE: [number, number] = [88.4335, 22.5762];
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
  "YOUR_MAPBOX_TOKEN_HERE";

let mapboxglCache: typeof import("mapbox-gl") | null = null;

async function fetchIsochrone(coords: [number, number]): Promise<any> {
  try {
    const r = await fetch(
      `https://api.mapbox.com/isochrone/v1/mapbox/driving/${coords[0]},${coords[1]}` +
        `?contours_minutes=10,20,30&polygons=true&access_token=${MAPBOX_TOKEN}`
    );
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function fetchRoute(
  from: [number, number],
  to: [number, number]
): Promise<any> {
  try {
    const r = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving` +
        `/${from[0]},${from[1]};${to[0]},${to[1]}` +
        `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.routes?.[0]?.geometry ?? null;
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
}: RelocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import("mapbox-gl").Map | null>(null);
  const mglRef       = useRef<typeof import("mapbox-gl") | null>(null);
  const markersRef   = useRef<import("mapbox-gl").Marker[]>([]);
  const popupRef     = useRef<import("mapbox-gl").Popup | null>(null);
  const routeTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mapReady,      setMapReady]      = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set());

  const office    = officeCoordinates ?? DEFAULT_OFFICE;
  const officeStr = officeLabel?.trim() || "Office";

  const pins = useMemo(
    () =>
      (properties?.filter((p) => p.location?.coordinates) ?? demoProperties)
        .filter((p) => p.location?.coordinates)
        .slice(0, 12),
    [properties]
  );

  /* ── overlay toggle ──────────────────────────────────── */
  const toggleOverlay = useCallback((key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  /* ── sync overlay toggles → Mapbox layer visibility ──── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const vis = (on: boolean): "visible" | "none" => (on ? "visible" : "none");
    if (map.getLayer("poi-label"))     map.setLayoutProperty("poi-label",     "visibility", vis(activeOverlays.has("cafe")));
    if (map.getLayer("transit-label")) map.setLayoutProperty("transit-label", "visibility", vis(activeOverlays.has("transit")));
  }, [activeOverlays, mapReady]);

  /* ── Effect 1: create map, isochrone rings, markers ─── */
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;
    let cancelled = false;

    void (async () => {
      if (!mapboxglCache) {
        mapboxglCache = await import("mapbox-gl");
        mapboxglCache.default.accessToken = MAPBOX_TOKEN;
      }
      if (cancelled || !containerRef.current) return;

      const mgl = mapboxglCache;
      mglRef.current = mgl;

      const map = new mgl.default.Map({
        container: containerRef.current!,
        style:     "mapbox://styles/mapbox/light-v11",
        center:    office,
        zoom:      12,
        pitch:     0,
        bearing:   0,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(
        new mgl.default.NavigationControl({ visualizePitch: false }),
        "top-right"
      );

      map.on("load", async () => {
        if (cancelled) return;
        setMapReady(true);

        /* hide POI and transit by default */
        if (map.getLayer("poi-label"))     map.setLayoutProperty("poi-label",     "visibility", "none");
        if (map.getLayer("transit-label")) map.setLayoutProperty("transit-label", "visibility", "none");

        /* ── Isochrone commute rings ────────────────────────── */
        const iso = await fetchIsochrone(office);
        if (!cancelled && iso?.features?.length) {
          const sorted = [...iso.features].sort(
            (a: any, b: any) => (b.properties?.contour ?? 0) - (a.properties?.contour ?? 0)
          );
          const RING = [
            { fill: "hsla(228, 72%, 58%, 0.055)", line: "hsla(228, 72%, 58%, 0.18)" },
            { fill: "hsla(228, 72%, 58%, 0.09)",  line: "hsla(228, 72%, 58%, 0.26)" },
            { fill: "hsla(228, 72%, 58%, 0.13)",  line: "hsla(228, 72%, 58%, 0.38)" },
          ];
          sorted.forEach((feat: any, i: number) => {
            const r = RING[i] ?? RING[RING.length - 1];
            const sid = `iso-src-${i}`;
            try {
              map.addSource(sid, { type: "geojson", data: feat });
              map.addLayer({ id: `iso-fill-${i}`,   type: "fill", source: sid, paint: { "fill-color": r.fill } });
              map.addLayer({ id: `iso-border-${i}`, type: "line", source: sid,
                paint: { "line-color": r.line, "line-width": 1.5, "line-dasharray": [3, 2] } });
            } catch {}
          });
        }

        /* ── Route layers (empty until property selected) ───── */
        try {
          map.addSource("route-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "route-bg",   type: "line", source: "route-src",
            layout: { "line-cap": "round", "line-join": "round" },
            paint:  { "line-color": "hsl(228, 72%, 78%)", "line-width": 5, "line-opacity": 0.28 } });
          map.addLayer({ id: "route-line", type: "line", source: "route-src",
            layout: { "line-cap": "round", "line-join": "round" },
            paint:  { "line-color": "hsl(228, 72%, 56%)", "line-width": 3.2, "line-opacity": 0.92,
                      "line-dasharray": [0, 4, 3] } });
        } catch {}

        /* ── Office marker ──────────────────────────────────── */
        const offEl = document.createElement("div");
        offEl.className = styles.officeMarker;
        offEl.innerHTML = `<span>${officeStr}</span>`;
        new mgl.default.Marker({ element: offEl, anchor: "bottom" })
          .setLngLat(office)
          .addTo(map);

        /* ── Property pins ──────────────────────────────────── */
        const counter   = new Map<string, number>();
        const newMarkers: import("mapbox-gl").Marker[] = [];

        pins.forEach((property, idx) => {
          const coords = property.location?.coordinates;
          if (!coords) return;
          const pos = spreadDupe(coords, counter);

          const el = document.createElement("button");
          el.type      = "button";
          el.className = styles.propertyMarker;
          el.setAttribute("aria-label", property.title);
          el.textContent = String(idx + 1);
          el.addEventListener("click", () => onMarkerClick?.(idx));

          /* staggered entrance */
          el.style.opacity   = "0";
          el.style.transform = "scale(0.3) translateY(16px)";
          setTimeout(() => {
            el.style.transition =
              "opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)";
            el.style.opacity   = "1";
            el.style.transform = "scale(1) translateY(0)";
          }, 420 + idx * 65);

          const marker = new mgl.default.Marker({ element: el, anchor: "center" })
            .setLngLat(pos)
            .addTo(map);
          newMarkers.push(marker);
        });

        markersRef.current = newMarkers;

        /* fit bounds — pad left to clear the floating glass panel */
        if (newMarkers.length > 0) {
          const bounds = new mgl.default.LngLatBounds(office, office);
          pins.forEach((p) => { if (p.location?.coordinates) bounds.extend(p.location.coordinates); });
          map.fitBounds(bounds, {
            padding:  { top: 60, bottom: 60, left: 450, right: 60 },
            maxZoom:  13,
            duration: 1400,
          });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (routeTimer.current) { clearInterval(routeTimer.current); routeTimer.current = null; }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, office[0], office[1], officeStr]);

  /* ── Effect 2: fly to active + draw route + popup ─────── */
  useEffect(() => {
    if (activePropertyIndex === undefined || activePropertyIndex === null) return;

    const map  = mapRef.current;
    const mgl  = mglRef.current;
    const prop = pins[activePropertyIndex];
    if (!map || !mgl || !prop?.location?.coordinates) return;

    /* compute spread position for this marker */
    const counter = new Map<string, number>();
    pins.slice(0, activePropertyIndex).forEach((p) => {
      if (p.location?.coordinates) spreadDupe(p.location.coordinates, counter);
    });
    const pos = spreadDupe(prop.location.coordinates, counter);

    /* remove stale popup */
    popupRef.current?.remove();
    popupRef.current = null;

    /* highlight active marker */
    markersRef.current.forEach((m, i) =>
      m.getElement().classList.toggle(styles.activeMarker, i === activePropertyIndex)
    );

    const run = async () => {
      /* stop previous route animation */
      if (routeTimer.current) { clearInterval(routeTimer.current); routeTimer.current = null; }

      /* fly to property — pad left for glass panel */
      map.flyTo({
        center:    pos,
        zoom:      14,
        duration:  900,
        essential: true,
        // @ts-ignore — padding in flyTo is supported in mapbox-gl v2+
        padding: { left: 450, top: 80, right: 80, bottom: 80 },
      });

      /* clear previous route */
      try {
        (map.getSource("route-src") as any)?.setData({ type: "FeatureCollection", features: [] });
      } catch {}

      /* fetch & draw route */
      const geom = await fetchRoute(office, pos);
      if (!geom || !mapRef.current) return;

      try {
        (map.getSource("route-src") as any)?.setData({ type: "Feature", properties: {}, geometry: geom });

        /* animated flowing dash */
        const DASH = [
          [0, 4, 3], [0.5, 4, 3], [1, 4, 3], [1.5, 4, 3],
          [2, 4, 3], [2.5, 4, 3], [3, 4, 3], [3.5, 4, 3],
        ];
        let step = 0;
        routeTimer.current = setInterval(() => {
          if (!mapRef.current?.getLayer("route-line")) return;
          try { mapRef.current.setPaintProperty("route-line", "line-dasharray", DASH[step % DASH.length]); } catch {}
          step++;
        }, 80);
      } catch {}

      /* open popup after fly settles */
      const popup = new mgl.default.Popup({
        closeButton: false,
        offset:      20,
        className:   "relo-popup",
        maxWidth:    "260px",
      })
        .setHTML(renderPopup(prop, activePropertyIndex))
        .setLngLat(pos);

      setTimeout(() => {
        if (mapRef.current) { popup.addTo(mapRef.current); popupRef.current = popup; }
      }, 750);
    };

    if (mapReady) void run();

    return () => {
      if (routeTimer.current) { clearInterval(routeTimer.current); routeTimer.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePropertyIndex, mapReady, pins, office[0], office[1]]);

  return (
    <div className={styles.mapCard}>
      <div ref={containerRef} className={styles.mapCanvas} />

      {/* ── Layer toggle controls ──────────────────────── */}
      <div className={styles.overlayControls}>
        <button
          className={`${styles.overlayBtn} ${activeOverlays.has("cafe") ? styles.overlayBtnOn : ""}`}
          onClick={() => toggleOverlay("cafe")}
          title="Show cafés & restaurants"
        >
          <Coffee size={13} />
          <span>Cafés</span>
        </button>
        <button
          className={`${styles.overlayBtn} ${activeOverlays.has("transit") ? styles.overlayBtnOn : ""}`}
          onClick={() => toggleOverlay("transit")}
          title="Show metro & transit"
        >
          <Train size={13} />
          <span>Metro</span>
        </button>
      </div>

      {/* ── Commute ring legend ────────────────────────── */}
      {mapReady && (
        <div className={styles.ringLegend}>
          <p className={styles.ringTitle}>Commute from office</p>
          <div className={styles.ringItems}>
            {(
              [
                ["10 min", 0.82],
                ["20 min", 0.52],
                ["30 min", 0.32],
              ] as [string, number][]
            ).map(([label, op]) => (
              <span key={label} className={styles.ringItem}>
                <span
                  className={styles.ringDot}
                  style={{ opacity: op }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Popup HTML ──────────────────────────────────────── */
function renderPopup(property: Property, idx: number) {
  const priceK   = Math.round(property.rent / 1000);
  const locality = [property.locality, property.city].filter(Boolean).join(", ");
  const commute  = property.commute_estimate_minutes
    ? `<span class="relo-popup-tag relo-popup-tag-commute">⏱ ${property.commute_estimate_minutes}\u202fmin</span>`
    : "";
  const dist =
    typeof property.distance_to_office_km === "number"
      ? `<span class="relo-popup-tag">📍 ${property.distance_to_office_km.toFixed(1)}\u202fkm</span>`
      : "";
  return `
    <div class="relo-popup-inner">
      <div class="relo-popup-header">
        <span class="relo-popup-num">${idx + 1}</span>
        <span class="relo-popup-locality">${locality || property.title}</span>
      </div>
      <div class="relo-popup-price">₹${priceK}k<span style="font-size:0.65rem;font-weight:500;color:#6e7d96">/mo</span></div>
      <div class="relo-popup-tags">${commute}${dist}</div>
    </div>`;
}

/* ── Golden-angle coordinate spread ─────────────────── */
function spreadDupe(
  coordinates: [number, number],
  counter: Map<string, number>
): [number, number] {
  const [lon, lat] = coordinates;
  const key = `${lon.toFixed(5)}:${lat.toFixed(5)}`;
  const idx = counter.get(key) ?? 0;
  counter.set(key, idx + 1);
  if (idx === 0) return [lon, lat];
  const angle  = idx * 137.5;
  const radius = Math.min(0.012, 0.0022 * idx);
  const rad    = (angle * Math.PI) / 180;
  const latOff = radius * Math.sin(rad);
  const lonOff = (radius * Math.cos(rad)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [lon + lonOff, lat + latOff];
}
