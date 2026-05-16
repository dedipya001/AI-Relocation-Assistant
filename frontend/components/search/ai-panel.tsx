"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MapPin, Clock, ArrowRight } from "lucide-react";
import { SearchBox } from "@/components/search/search-box";
import { PropertyCard } from "@/components/property/property-card";
import { useSearchStore } from "@/store/search-store";
import type { Property } from "@/types";
import styles from "./ai-panel.module.css";

interface AIPanelProps {
  properties: Property[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function AIPanel({ properties, activeIndex, onSelect }: AIPanelProps) {
  const { isLoading, response } = useSearchStore();
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Keep the active card visible in the scrollable list
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  const officeLabel = response?.intent?.filters?.office_location;
  const hasResults = properties.length > 0 && !isLoading;

  return (
    <aside className={styles.panel}>
      {/* ── Header: brand + conversational search ── */}
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Sparkles size={13} />
          </div>
          <span className={styles.brandText}>Relocation AI</span>
        </div>
        <SearchBox compact />
      </div>

      {/* ── AI context bar: loading skeleton or summary ── */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            className={styles.contextBar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LoadingState />
          </motion.div>
        )}

        {hasResults && (
          <motion.div
            key="summary"
            className={styles.contextBar}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <AISummary
              count={properties.length}
              officeLabel={officeLabel}
              topProperty={properties[0]}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable property list ── */}
      <div className={styles.list} role="list">
        {hasResults
          ? properties.map((property, index) => (
              <motion.div
                key={property._id}
                role="listitem"
                ref={index === activeIndex ? activeItemRef : undefined}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: Math.min(index * 0.042, 0.55),
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <PropertyCard
                  property={property}
                  index={index}
                  isActive={index === activeIndex}
                  onClick={() => onSelect(index)}
                />
              </motion.div>
            ))
          : !isLoading && <EmptyState />}
      </div>
    </aside>
  );
}

/* ── Loading skeleton ─────────────────────────────────── */
const THINKING_STAGES = [
  "Locating your office…",
  "Analyzing commute patterns…",
  "Finding quieter neighbourhoods…",
  "Comparing lifestyle signals…",
  "Curating your top matches…",
];
const STAGE_DELAYS = [0, 700, 1500, 2400, 3300];

function LoadingState() {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    setStageIdx(0);
    const timers = STAGE_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setStageIdx(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={styles.loading}>
      <div className={styles.loadingRow}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={styles.dot}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.7, 1, 0.7] }}
            transition={{ duration: 1.1, delay: i * 0.18, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <AnimatePresence mode="wait">
          <motion.span
            key={stageIdx}
            className={styles.loadingText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28 }}
          >
            {THINKING_STAGES[stageIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={styles.shimmerStack}>
        {[100, 78, 90].map((w, i) => (
          <div key={i} className={styles.shimmerBar} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ── AI narrative summary ─────────────────────────────── */
function AISummary({
  count,
  officeLabel,
  topProperty,
}: {
  count: number;
  officeLabel?: string;
  topProperty?: Property;
}) {
  const commute = topProperty?.commute_estimate_minutes;
  const dist    = topProperty?.distance_to_office_km;

  return (
    <div className={styles.summary}>
      <p className={styles.summaryTitle}>
        <Sparkles size={12} className={styles.summaryIcon} />
        {count} homes near {officeLabel ?? "your office"}
      </p>
      <p className={styles.summaryBody}>
        {topProperty?.locality ? (
          <>
            Closest match in{" "}
            <strong>{topProperty.locality}</strong>
            {commute != null && (
              <>
                {" "}·{" "}
                <Clock size={11} className={styles.inlineIcon} />
                {" "}{commute}&thinsp;min
              </>
            )}
            {dist != null && (
              <>
                {" "}·{" "}
                <MapPin size={11} className={styles.inlineIcon} />
                {" "}{dist.toFixed(1)}&thinsp;km
              </>
            )}
            . Ranked by commute &amp; lifestyle fit.
          </>
        ) : (
          "Results ranked by commute and lifestyle fit."
        )}
      </p>
    </div>
  );
}

/* ── Empty / pre-search state ─────────────────────────── */
function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyOrb}>
        <MapPin size={20} />
      </div>
      <p className={styles.emptyTitle}>Describe where you want to live</p>
      <p className={styles.emptyDesc}>
        Tell the AI your office location, commute limit, budget, and the lifestyle that matters to you.
      </p>
      <div className={styles.emptyHint}>
        <ArrowRight size={12} />
        <em>
          &ldquo;Office at Sector V · rent ≤ ₹20k · good cafés · quiet evenings&rdquo;
        </em>
      </div>
    </div>
  );
}
