"use client";

import { motion } from "framer-motion";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSearchStore } from "@/store/search-store";
import styles from "./recommendation-list.module.css";

export function RecommendationList() {
  const { response, isLoading, error } = useSearchStore();

  if (error) {
    return <Card className={`${styles.state} ${styles.error}`}>{error}</Card>;
  }

  if (isLoading) {
    return <Card className={styles.state}>Ranking commute, rent, safety, internet, and lifestyle fit...</Card>;
  }

  const recommendations = response?.recommendations ?? [];
  if (!recommendations.length) {
    return <Card className={styles.state}>Run a search to see AI-ranked living options.</Card>;
  }

  return (
    <div className={styles.list}>
      {recommendations.map((item, index) => (
        <motion.div key={item.entity_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
          <Card className={styles.item}>
            <div className={styles.row}>
              <div>
                <div className={styles.match}>
                  <BrainCircuit size={16} /> Match {item.score.total}
                </div>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.explanation}>{item.score.explanation}</p>
              </div>
              <ChevronRight size={18} className={styles.chevron} />
            </div>
            <div className={styles.chips}>
              {item.highlights.map((highlight) => (
                <span key={highlight} className={styles.chip}>
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
