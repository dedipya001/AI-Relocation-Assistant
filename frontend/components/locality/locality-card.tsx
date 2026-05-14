import Link from "next/link";
import { Shield, Utensils, Wifi } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Locality } from "@/types";
import styles from "./locality-card.module.css";

export function LocalityCard({ locality }: { locality: Locality }) {
  return (
    <Card className={styles.card}>
      <Link href={`/locality/${locality._id}`} className={styles.title}>
        {locality.name}
      </Link>
      <p className={styles.summary}>{locality.summary}</p>
      <div className={styles.metrics}>
        <Metric icon={Shield} label="Safety" value={locality.scores.overall} />
        <Metric icon={Wifi} label="Internet" value={locality.scores.internet} />
        <Metric icon={Utensils} label="Food" value={locality.scores.food_access} />
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>
        <Icon size={13} />
        {label}
      </div>
      <p className={styles.metricValue}>{value}</p>
    </div>
  );
}
