"use client";

import { useEffect } from "react";
import { FilterSidebar } from "@/components/search/filter-sidebar";
import { RecommendationList } from "@/components/search/recommendation-list";
import { SearchBox } from "@/components/search/search-box";
import { RelocationMap } from "@/components/map/relocation-map";
import { PropertyCard } from "@/components/property/property-card";
import { Card } from "@/components/ui/card";
import { useSearchStore } from "@/store/search-store";
import styles from "./search-client.module.css";

export function SearchClient() {
  const { response, runSearch } = useSearchStore();

  useEffect(() => {
    if (!response) void runSearch();
  }, [response, runSearch]);

  return (
    <div className={styles.layout}>
      <FilterSidebar />
      <section className={styles.workspace}>
        <Card className={styles.searchCard}>
          <SearchBox />
        </Card>
        <RelocationMap properties={response?.properties} />
        <div className={styles.propertyGrid}>
          {(response?.properties ?? []).map((property, index) => (
            <PropertyCard key={property._id} property={property} index={index} />
          ))}
        </div>
      </section>
      <aside className={styles.ranking}>
        <h2 className={styles.rankingTitle}>AI ranking</h2>
        <RecommendationList />
      </aside>
    </div>
  );
}
