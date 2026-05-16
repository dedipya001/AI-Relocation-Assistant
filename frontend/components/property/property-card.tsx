"use client";

import { motion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import type { Property } from "@/types";
import styles from "./property-card.module.css";

interface PropertyCardProps {
  property: Property;
  index?: number;
  isActive?: boolean;
  onClick?: () => void;
}

/* Map raw amenity strings to compact display labels */
const AMENITY_LABELS: Record<string, string> = {
  "high-speed internet":  "WiFi",
  internet:               "WiFi",
  wifi:                   "WiFi",
  gym:                    "Gym",
  metro:                  "Metro",
  parking:                "Parking",
  security:               "Secure",
  "24/7 security":        "Secure",
  pool:                   "Pool",
  "power backup":         "Backup",
  "swimming pool":        "Pool",
  "modular kitchen":      "Kitchen",
  "1bhk":                 "1BHK",
  "2bhk":                 "2BHK",
  "3bhk":                 "3BHK",
  "4bhk":                 "4BHK",
  "1 bhk":                "1BHK",
  "2 bhk":                "2BHK",
  "3 bhk":                "3BHK",
  "4 bhk":                "4BHK",
};

/* Platforms / source names / meta tags to suppress from amenity display */
const SKIP_TAGS = new Set([
  "magicbricks", "housing.com", "99acres", "nobroker", "housing", "makaan",
  "dataset-imported", "scraped", "api-imported", "no data", "n/a", "na",
  /* furnishing variants — already shown in subtitle */
  "furnished", "unfurnished", "semi-furnished", "semi furnished",
  "fully furnished", "partially furnished",
]);

function label(raw: string): string {
  return AMENITY_LABELS[raw.toLowerCase()] ?? raw;
}

/* Derive "why recommended" reasons from property data */
function getWhyReasons(property: Property): string[] {
  const reasons: string[] = [];
  const amenitiesLower = (property.amenities ?? []).map((a) => a.toLowerCase());
  const commute = property.commute_estimate_minutes;
  const dist    = property.distance_to_office_km;

  if (commute != null && commute <= 22)
    reasons.push(`${commute} min commute`);
  if (dist != null && dist <= 4)
    reasons.push(`${dist.toFixed(1)} km away`);
  if (amenitiesLower.some((a) => a.includes("wifi") || a.includes("internet")))
    reasons.push("Fast internet");
  if (amenitiesLower.some((a) => a.includes("metro")))
    reasons.push("Metro access");
  if (property.furnishing?.toLowerCase() === "furnished")
    reasons.push("Move-in ready");
  if (property.rent < 15000)
    reasons.push("Under ₹15k");

  return reasons.slice(0, 3);
}

export function PropertyCard({
  property,
  index = 0,
  isActive = false,
  onClick,
}: PropertyCardProps) {
  const commute = property.commute_estimate_minutes;
  const dist    = property.distance_to_office_km;
  const priceK  = Math.round(property.rent / 1000);

  /* Smart tag array — commute + dist rendered explicitly, then amenities only */
  const amenityTags = property.amenities
    .filter((a) => !SKIP_TAGS.has(a.toLowerCase()) && a.length > 1 && a.length < 28)
    .slice(0, 3)
    .map(label);

  const whyReasons = getWhyReasons(property);

  return (
    <motion.button
      type="button"
      className={`${styles.card} ${isActive ? styles.active : ""}`}
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
        {/* Row 1 — locality + price */}
        <div className={styles.topRow}>
          <div className={styles.locationBlock}>
            <span className={styles.locality}>
              {property.locality ?? property.city ?? "—"}
            </span>
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
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>

        {/* Row 4 — WHY recommended */}
        {whyReasons.length > 0 && (
          <div className={styles.whyRow}>
            {whyReasons.map((r) => (
              <span key={r} className={styles.whyTag}>✓ {r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Active left-edge accent bar */}
      {isActive && <div className={styles.accentBar} />}
    </motion.button>
  );
}
