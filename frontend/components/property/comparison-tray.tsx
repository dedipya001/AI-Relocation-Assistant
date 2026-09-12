"use client";

import Link from "next/link";
import { Scale, X } from "lucide-react";
import type { Property } from "@/types";
import { useCompareStore } from "@/store/compare-store";
import styles from "./comparison-tray.module.css";

export function ComparisonTray({ properties }: { properties: Property[] }) {
  const { propertyIds, remove, clear } = useCompareStore();
  const selected = propertyIds
    .map((id) => properties.find((property) => property._id === id))
    .filter((property): property is Property => Boolean(property));

  if (selected.length === 0) return null;

  const href = `/compare?ids=${selected.map((property) => encodeURIComponent(property._id)).join(",")}`;

  return (
    <div className={styles.tray} aria-label="Property comparison tray">
      <div className={styles.header}>
        <span><Scale size={13} /> Compare {selected.length}/4</span>
        <button type="button" onClick={clear} className={styles.clear}>Clear</button>
      </div>
      <div className={styles.items}>
        {selected.map((property) => (
          <div key={property._id} className={styles.item}>
            <span>{property.locality ?? property.title}</span>
            <button type="button" aria-label={`Remove ${property.title}`} onClick={() => remove(property._id)}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className={`${styles.compare} ${selected.length < 2 ? styles.disabled : ""}`}
        aria-disabled={selected.length < 2}
        onClick={(event) => { if (selected.length < 2) event.preventDefault(); }}
      >
        Compare side by side
      </Link>
      {selected.length < 2 && <p className={styles.hint}>Select at least 2 homes.</p>}
    </div>
  );
}
