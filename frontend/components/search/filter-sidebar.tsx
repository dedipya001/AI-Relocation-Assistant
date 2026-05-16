import { Bus, Home, IndianRupee, Shield, Wifi } from "lucide-react";
import { Card } from "@/components/ui/card";
import styles from "./filter-sidebar.module.css";

const filters = [
  { label: "Under 15k", icon: IndianRupee },
  { label: "PG or shared", icon: Home },
  { label: "Metro commute", icon: Bus },
  { label: "Women safety", icon: Shield },
  { label: "Fast internet", icon: Wifi }
];

export function FilterSidebar() {
  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.heading}>Lifestyle signals</h2>
      {filters.map((filter) => (
        <Card key={filter.label} className={styles.filter}>
          <span className={styles.iconBox}>
            <filter.icon size={17} />
          </span>
          <span className={styles.label}>{filter.label}</span>
        </Card>
      ))}
    </aside>
  );
}
