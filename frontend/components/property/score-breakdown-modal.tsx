"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Wifi,
  Utensils,
  Home,
  Clock,
  DollarSign,
} from "lucide-react";
import type { Property, Recommendation } from "@/types";
import styles from "./score-breakdown-modal.module.css";

interface ScoreBreakdownModalProps {
  property: Property;
  recommendation?: Recommendation;
  isOpen: boolean;
  onClose: () => void;
}

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  affordability: <DollarSign size={14} />,
  commute: <Clock size={14} />,
  safety: <ShieldCheck size={14} />,
  internet: <Wifi size={14} />,
  food_access: <Utensils size={14} />,
  lifestyle_fit: <Zap size={14} />,
  property_quality: <Home size={14} />,
};

function getScoreColor(score: number): string {
  if (score >= 85) return "#10b981"; // Emerald
  if (score >= 72) return "#38bdf8"; // Sky
  if (score >= 60) return "#f59e0b"; // Amber
  return "#f43f5e"; // Rose
}

export function ScoreBreakdownModal({
  property,
  recommendation,
  isOpen,
  onClose,
}: ScoreBreakdownModalProps) {
  if (!isOpen) return null;

  const score = recommendation?.score;
  const subscores = score?.subscores ? Object.entries(score.subscores) : [];
  const totalScore = score?.total ?? 75;
  const confidence = score?.confidence_score ?? 85;
  const violations = recommendation?.constraint_violations ?? [];
  const highlights = recommendation?.highlights ?? [];
  const tradeoffs = recommendation?.tradeoffs ?? [];
  const explanation =
    score?.explanation ??
    `${property.title} was scored based on rent, commute, and neighbourhood signals.`;

  return (
    <AnimatePresence>
      <div className={styles.backdrop} onClick={onClose}>
        <motion.div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* ── Modal Header ── */}
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <div className={styles.tagRow}>
                <span className={styles.profileBadge}>
                  <Sparkles size={11} /> {recommendation?.scoring_profile?.replace("_", " ").toUpperCase() || "BALANCED"}
                </span>
                {recommendation?.rank && (
                  <span className={styles.rankBadge}>Rank #{recommendation.rank}</span>
                )}
                {recommendation?.is_eligible === false && (
                  <span className={styles.ineligibleBadge}>Constraint Violation</span>
                )}
              </div>
              <h2 className={styles.title}>{property.title}</h2>
              <p className={styles.localityText}>
                {property.locality || property.city || "Kolkata"} · ₹{property.rent.toLocaleString("en-IN")}/mo
              </p>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* ── Score Overview Hero ── */}
          <div className={styles.heroScoreCard}>
            <div className={styles.heroScoreLeft}>
              <div
                className={styles.scoreCircle}
                style={{ borderColor: getScoreColor(totalScore) }}
              >
                <span className={styles.scoreNumber} style={{ color: getScoreColor(totalScore) }}>
                  {totalScore}
                </span>
                <span className={styles.scoreMax}>/ 100</span>
              </div>
              <div className={styles.scoreText}>
                <h3 className={styles.scoreHeading}>Composite Match Score</h3>
                <p className={styles.scoreSub}>
                  Calculated using 7 weighted criteria &amp; active persona settings.
                </p>
              </div>
            </div>
            <div className={styles.heroScoreRight}>
              <div className={styles.confidencePill}>
                <TrendingUp size={12} className={styles.confidenceIcon} />
                <span>{confidence}% Confidence</span>
              </div>
            </div>
          </div>

          {/* ── Hard Constraint Violations Warning (if any) ── */}
          {violations.length > 0 && (
            <div className={styles.violationsCard}>
              <div className={styles.violationsHeader}>
                <AlertTriangle size={15} className={styles.warningIcon} />
                <span>Hard Constraint Violations Detected</span>
              </div>
              <ul className={styles.violationsList}>
                {violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Itemized Factor Breakdown ── */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Weighted Factor Breakdown</h4>
            <div className={styles.factorList}>
              {subscores.map(([key, data]) => {
                const barColor = getScoreColor(data.score);
                const weightPct = Math.round(data.weight * 100);
                return (
                  <div key={key} className={styles.factorItem}>
                    <div className={styles.factorHeader}>
                      <div className={styles.factorLabel}>
                        <span className={styles.factorIcon}>
                          {FACTOR_ICONS[key] || <Zap size={14} />}
                        </span>
                        <span className={styles.factorName}>{data.label}</span>
                      </div>
                      <div className={styles.factorMetrics}>
                        <span className={styles.factorScore} style={{ color: barColor }}>
                          {data.score}/100
                        </span>
                        <span className={styles.factorWeight}>
                          ({weightPct}% wt → +{data.contribution} pts)
                        </span>
                      </div>
                    </div>
                    <div className={styles.barTrack}>
                      <motion.div
                        className={styles.barFill}
                        style={{ backgroundColor: barColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${data.score}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    {data.details && (
                      <p className={styles.factorDetails}>{data.details}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Highlights & Tradeoffs ── */}
          <div className={styles.insightsGrid}>
            {highlights.length > 0 && (
              <div className={styles.insightBox}>
                <h5 className={styles.insightTitlePositive}>
                  <CheckCircle2 size={13} /> Key Strengths
                </h5>
                <ul className={styles.insightList}>
                  {highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {tradeoffs.length > 0 && (
              <div className={styles.insightBox}>
                <h5 className={styles.insightTitleNegative}>
                  <AlertTriangle size={13} /> Tradeoffs &amp; Caveats
                </h5>
                <ul className={styles.insightList}>
                  {tradeoffs.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── AI Explanation Summary ── */}
          <div className={styles.explanationBox}>
            <div className={styles.explanationHeader}>
              <Sparkles size={13} className={styles.sparkleIcon} />
              <span>AI Recommendation Context</span>
            </div>
            <p className={styles.explanationText}>{explanation}</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
