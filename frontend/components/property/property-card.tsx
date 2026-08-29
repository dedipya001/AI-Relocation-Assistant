"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, Sparkles, AlertTriangle, ChevronRight } from "lucide-react";
import type { Property, Recommendation } from "@/types";
import { ScoreBreakdownModal } from "./score-breakdown-modal";
import styles from "./property-card.module.css";

interface PropertyCardProps {
  property: Property;
  recommendation?: Recommendation;
  index?: number;
  isActive?: boolean;
  onClick?: () => void;
}

const AMENITY_LABELS: Record<string, string> = {
  "high-speed internet": "WiFi",
  internet: "WiFi",
  wifi: "WiFi",
  gym: "Gym",
  metro: "Metro",
  parking: "Parking",
  security: "Secure",
  "24/7 security": "Secure",
  pool: "Pool",
  "power backup": "Backup",
  "swimming pool": "Pool",
  "modular kitchen": "Kitchen",
  "1bhk": "1BHK",
  "2bhk": "2BHK",
  "3bhk": "3BHK",
  "4bhk": "4BHK",
  "1 bhk": "1BHK",
  "2 bhk": "2BHK",
  "3 bhk": "3BHK",
  "4 bhk": "4BHK",
};

const SKIP_TAGS = new Set([
  "magicbricks",
  "housing.com",
  "99acres",
  "nobroker",
  "housing",
  "makaan",
  "dataset-imported",
  "scraped",
  "api-imported",
  "no data",
  "n/a",
  "na",
  "furnished",
  "unfurnished",
  "semi-furnished",
  "semi furnished",
  "fully furnished",
  "partially furnished",
]);

function label(raw: string): string {
  return AMENITY_LABELS[raw.toLowerCase()] ?? raw;
}

function getScoreBadgeClass(score: number): string {
  if (score >= 85) return styles.scoreHigh;
  if (score >= 72) return styles.scoreMid;
  if (score >= 60) return styles.scoreFair;
  return styles.scoreLow;
}

export function PropertyCard({
  property,
  recommendation,
  index = 0,
  isActive = false,
  onClick,
}: PropertyCardProps) {
  const [showModal, setShowModal] = useState(false);

  const commute = property.commute_estimate_minutes;
  const dist = property.distance_to_office_km;
  const priceK = Math.round(property.rent / 1000);

  const totalScore = recommendation?.score?.total;
  const violations = recommendation?.constraint_violations ?? [];
  const isEligible = recommendation?.is_eligible !== false;

  const amenityTags = property.amenities
    .filter((a) => !SKIP_TAGS.has(a.toLowerCase()) && a.length > 1 && a.length < 28)
    .slice(0, 3)
    .map(label);

  const highlights = recommendation?.highlights ?? [];

  return (
    <>
      <motion.div
        className={`${styles.card} ${isActive ? styles.active : ""} ${
          !isEligible ? styles.cardIneligible : ""
        }`}
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 480, damping: 28 }}
      >
        {/* Left: numbered index badge */}
        <div className={`${styles.badge} ${isActive ? styles.badgeActive : ""}`}>
          {index + 1}
        </div>

        {/* Right: property info */}
        <div className={styles.body}>
          {/* Row 1 — locality + score badge + price */}
          <div className={styles.topRow}>
            <div className={styles.locationBlock}>
              <div className={styles.localityRow}>
                <span className={styles.locality}>
                  {property.locality ?? property.city ?? "—"}
                </span>
                {totalScore != null && (
                  <span
                    className={`${styles.scorePill} ${getScoreBadgeClass(totalScore)}`}
                    title="Click 'Score Breakdown' below for explainable factor contributions"
                  >
                    ★ {totalScore}
                  </span>
                )}
              </div>
              {property.city && property.locality && (
                <span className={styles.city}>{property.city}</span>
              )}
            </div>
            <div className={styles.priceBlock}>
              <span className={styles.price}>₹{priceK}k</span>
              <span className={styles.priceSuffix}>/mo</span>
            </div>
          </div>

          {/* Row 2 — property type */}
          <p className={styles.subtitle}>
            {property.property_type}
            {property.furnishing ? ` · ${property.furnishing}` : ""}
          </p>

          {/* Constraint Violations Alert if any */}
          {violations.length > 0 && (
            <div className={styles.violationTag}>
              <AlertTriangle size={10} />
              <span>{violations[0]}</span>
            </div>
          )}

          {/* Row 3 — smart tags */}
          <div className={styles.tags}>
            {commute != null && (
              <span className={`${styles.tag} ${styles.tagCommute}`}>
                <Clock size={9} /> {commute}&thinsp;min
              </span>
            )}
            {dist != null && (
              <span className={styles.tag}>
                <MapPin size={9} /> {dist.toFixed(1)}&thinsp;km
              </span>
            )}
            {amenityTags.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>

          {/* Row 4 — Top positive highlights */}
          {highlights.length > 0 && (
            <div className={styles.whyRow}>
              {highlights.slice(0, 2).map((h, i) => (
                <span key={i} className={styles.whyTag}>
                  ✓ {h}
                </span>
              ))}
            </div>
          )}

          {/* Row 5 — Explain Score button trigger */}
          {recommendation && (
            <button
              type="button"
              className={styles.explainBtn}
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
            >
              <Sparkles size={10} />
              <span>Explain Score &amp; Factors</span>
              <ChevronRight size={10} />
            </button>
          )}
        </div>

        {/* Active left-edge accent bar */}
        {isActive && <div className={styles.accentBar} />}
      </motion.div>

      {/* Transparent Explainable Score Modal */}
      <ScoreBreakdownModal
        property={property}
        recommendation={recommendation}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
