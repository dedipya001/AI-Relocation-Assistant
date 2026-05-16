"use client";

import { useEffect, useState } from "react";
import { AIPanel } from "@/components/search/ai-panel";
import { RelocationMap } from "@/components/map/relocation-map";
import { useSearchStore } from "@/store/search-store";
import type { Property } from "@/types";
import styles from "./search-client.module.css";

export function SearchClient() {
  const { response, runSearch } = useSearchStore();
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-search on first mount
  useEffect(() => {
    if (!response) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset active card when new results arrive
  useEffect(() => {
    setActiveIndex(0);
  }, [response]);

  const properties: Property[] = response?.properties ?? [];

  return (
    <div className={styles.container}>
      {/* Map fills the entire canvas — it IS the background */}
      <div className={styles.mapPane}>
        <RelocationMap
          properties={properties}
          activePropertyIndex={activeIndex}
          officeCoordinates={response?.office_coordinates ?? undefined}
          officeLabel={response?.intent?.filters?.office_location}
          onMarkerClick={setActiveIndex}
        />
      </div>

      {/* AI panel floats over the map as a glass overlay */}
      <AIPanel
        properties={properties}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />
    </div>
  );
}
