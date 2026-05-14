"use client";

import { useEffect } from "react";
import { FilterSidebar } from "@/components/search/filter-sidebar";
import { RecommendationList } from "@/components/search/recommendation-list";
import { SearchBox } from "@/components/search/search-box";
import { RelocationMap } from "@/components/map/relocation-map";
import { PropertyCard } from "@/components/property/property-card";
import { Card } from "@/components/ui/card";
import { useSearchStore } from "@/store/search-store";

export function SearchClient() {
  const { response, runSearch } = useSearchStore();

  useEffect(() => {
    if (!response) void runSearch();
  }, [response, runSearch]);

  return (
    <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_390px]">
      <FilterSidebar />
      <section className="space-y-4">
        <Card className="p-4">
          <SearchBox />
        </Card>
        <RelocationMap />
        <div className="grid gap-4 md:grid-cols-2">
          {(response?.properties ?? []).map((property, index) => (
            <PropertyCard key={property._id} property={property} index={index} />
          ))}
        </div>
      </section>
      <aside className="space-y-3">
        <h2 className="font-semibold">AI ranking</h2>
        <RecommendationList />
      </aside>
    </div>
  );
}
