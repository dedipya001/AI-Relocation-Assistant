"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { demoProperties } from "@/lib/demo-data";
import { formatRent } from "@/lib/utils";
import type { Property } from "@/types";
import styles from "./relocation-map.module.css";

type RelocationMapProps = {
  properties?: Property[];
  activePropertyId?: string;
};

const OFFICE_COORDINATES: [number, number] = [88.4335, 22.5762];
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
  "YOUR_MAPBOX_TOKEN_HERE";

export function RelocationMap({ properties, activePropertyId }: RelocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasInteractiveMap, setHasInteractiveMap] = useState(false);
  const visibleProperties = useMemo(
    () => (properties?.filter((property) => property.location?.coordinates) ?? demoProperties).filter((property) => property.location?.coordinates),
    [properties]
  );

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current) return;

    let map: import("mapbox-gl").Map | undefined;
    const markers: import("mapbox-gl").Marker[] = [];

    void import("mapbox-gl").then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.default.Map({
        container: mapRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: OFFICE_COORDINATES,
        zoom: 11.8,
        pitch: 42,
        bearing: -12,
        attributionControl: false
      });

      map.addControl(new mapboxgl.default.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("load", () => {
        setHasInteractiveMap(true);
        const bounds = new mapboxgl.default.LngLatBounds(OFFICE_COORDINATES, OFFICE_COORDINATES);

        const officeMarker = document.createElement("div");
        officeMarker.className = styles.officeMarker;
        officeMarker.innerHTML = `<span>Office</span>`;
        markers.push(new mapboxgl.default.Marker({ element: officeMarker, anchor: "bottom" }).setLngLat(OFFICE_COORDINATES).addTo(map!));

        visibleProperties.forEach((property, index) => {
          const coordinates = property.location?.coordinates;
          if (!coordinates) return;
          bounds.extend(coordinates);

          const marker = document.createElement("button");
          marker.type = "button";
          marker.className = `${styles.propertyMarker} ${property._id === activePropertyId ? styles.activeMarker : ""}`;
          marker.setAttribute("aria-label", property.title);
          marker.innerHTML = `<span>${formatRent(property.rent).replace("Rs ", "Rs")}</span>`;

          const popup = new mapboxgl.default.Popup({ closeButton: true, offset: 26, className: styles.popup })
            .setHTML(renderPopup(property));

          const mapMarker = new mapboxgl.default.Marker({ element: marker, anchor: "bottom" }).setLngLat(coordinates).setPopup(popup).addTo(map!);
          markers.push(mapMarker);

          if (index === 0) {
            setTimeout(() => mapMarker.togglePopup(), 900);
          }
        });

        if (!bounds.isEmpty()) {
          map!.fitBounds(bounds, { padding: 88, maxZoom: 13.8, duration: 1100 });
        }
      });
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map?.remove();
      setHasInteractiveMap(false);
    };
  }, [activePropertyId, visibleProperties]);

  return (
    <Card className={styles.mapCard}>
      <div ref={mapRef} className={styles.mapCanvas} />
      {!hasInteractiveMap && (
        <>
          <div className={styles.grid} />
          <div className={styles.office}>Sector V office</div>
          <Pin className={styles.newTown} label="New Town" score="82" />
          <Pin className={styles.sectorV} label="Sector V" score="78" />
          <Pin className={styles.lakeTown} label="Lake Town" score="76" />
        </>
      )}
      <div className={styles.legend}>
        <p className={styles.legendTitle}>
          <Navigation size={15} /> Live property map
        </p>
        <p className={styles.legendText}>Animated rent pins highlight homes near office, commute corridors, and high-fit India localities.</p>
      </div>
    </Card>
  );
}

function Pin({ className, label, score }: { className: string; label: string; score: string }) {
  return (
    <div className={`${styles.pin} ${className}`}>
      <div className={styles.pinBody}>
        <MapPin size={16} className={styles.pinIcon} />
        <span>{label}</span>
        <span className={styles.score}>{score}</span>
      </div>
    </div>
  );
}

function renderPopup(property: Property) {
  const lowest = property.lowest_price?.rent ?? property.rent;
  return `
    <article class="property-popup">
      <div class="property-popup__eyebrow">${property.property_type} • ${property.source_platform}</div>
      <h3>${property.title}</h3>
      <div class="property-popup__rent">${formatRent(property.rent)} <span>/ month</span></div>
      <p>${property.commute_estimate_minutes ?? "TBD"} min commute • ${property.nearby_metro ?? "Metro TBD"}</p>
      <strong>Lowest seen: ${formatRent(lowest)}</strong>
    </article>
  `;
}
