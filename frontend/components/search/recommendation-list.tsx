"use client";

import { motion } from "framer-motion";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSearchStore } from "@/store/search-store";

export function RecommendationList() {
  const { response, isLoading, error } = useSearchStore();

  if (error) {
    return <Card className="p-4 text-sm text-red-700">{error}</Card>;
  }

  if (isLoading) {
    return <Card className="p-4 text-sm text-foreground/65">Ranking commute, rent, safety, internet, and lifestyle fit...</Card>;
  }

  const recommendations = response?.recommendations ?? [];
  if (!recommendations.length) {
    return <Card className="p-4 text-sm text-foreground/65">Run a search to see AI-ranked living options.</Card>;
  }

  return (
    <div className="space-y-3">
      {recommendations.map((item, index) => (
        <motion.div key={item.entity_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <BrainCircuit size={16} /> Match {item.score.total}
                </div>
                <h3 className="mt-1 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-foreground/65">{item.score.explanation}</p>
              </div>
              <ChevronRight size={18} className="mt-1 text-foreground/45" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.highlights.map((highlight) => (
                <span key={highlight} className="rounded-lg bg-muted px-2 py-1 text-xs font-medium">
                  {highlight}
                </span>
              ))}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
