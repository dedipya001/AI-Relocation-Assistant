"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import styles from "./relocation-map.module.css";

export function RelocationMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || !mapRef.current) return;

    let map: import("mapbox-gl").Map | undefined;
    void import("mapbox-gl").then((mapboxgl) => {
      mapboxgl.default.accessToken = token;
      map = new mapboxgl.default.Map({
        container: mapRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [88.443, 22.58],
        zoom: 11.2
      });
    });
    return () => map?.remove();
  }, []);

  return (
    <Card className={styles.mapCard}>
      <div ref={mapRef} className={styles.mapCanvas} />
      <div className={styles.grid} />
      <div className={styles.office}>Sector V office</div>
      <Pin className={styles.newTown} label="New Town" score="82" />
      <Pin className={styles.sectorV} label="Sector V" score="78" />
      <Pin className={styles.lakeTown} label="Lake Town" score="76" />
      <div className={styles.legend}>
        <p className={styles.legendTitle}>Map-first relocation intelligence</p>
        <p className={styles.legendText}>Connect Mapbox or Google Maps keys for live commute, traffic, and neighborhood layers.</p>
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
