"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";

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
    <Card className="relative min-h-[520px] overflow-hidden bg-[#eef3ef]">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="map-grid absolute inset-0" />
      <div className="absolute left-[42%] top-[38%] rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-soft">
        Sector V office
      </div>
      <Pin className="left-[60%] top-[34%]" label="New Town" score="82" />
      <Pin className="left-[35%] top-[32%]" label="Sector V" score="78" />
      <Pin className="left-[25%] top-[48%]" label="Lake Town" score="76" />
      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-border bg-white/90 p-3 backdrop-blur">
        <p className="text-sm font-semibold">Map-first relocation intelligence</p>
        <p className="mt-1 text-xs text-foreground/60">Connect Mapbox or Google Maps keys for live commute, traffic, and neighborhood layers.</p>
      </div>
    </Card>
  );
}

function Pin({ className, label, score }: { className: string; label: string; score: string }) {
  return (
    <div className={`absolute ${className}`}>
      <div className="flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-soft">
        <MapPin size={16} className="text-accent" />
        <span>{label}</span>
        <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-white">{score}</span>
      </div>
    </div>
  );
}
