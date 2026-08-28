"use client";

import { motion } from "framer-motion";
import { Sparkles, Shield, DollarSign, Laptop, Users, Moon } from "lucide-react";
import { useSearchStore } from "@/store/search-store";
import type { ScoringProfile } from "@/types";
import styles from "./persona-selector.module.css";

interface PersonaOption {
  id: ScoringProfile;
  label: string;
  icon: React.ReactNode;
  hint: string;
}

const PERSONAS: PersonaOption[] = [
  {
    id: "balanced",
    label: "Balanced",
    icon: <Sparkles size={13} />,
    hint: "Even balance of rent, commute & livability",
  },
  {
    id: "tech_professional",
    label: "Tech Pro",
    icon: <Laptop size={13} />,
    hint: "Short commute & gigabit internet priority",
  },
  {
    id: "budget_saver",
    label: "Budget Saver",
    icon: <DollarSign size={13} />,
    hint: "Maximum rent savings & value focus",
  },
  {
    id: "safety_priority",
    label: "Safety First",
    icon: <Shield size={13} />,
    hint: "Women safety & late-night security priority",
  },
  {
    id: "family_first",
    label: "Family",
    icon: <Users size={13} />,
    hint: "Spacious apartments, safety & grocery access",
  },
  {
    id: "night_owl",
    label: "Night Owl",
    icon: <Moon size={13} />,
    hint: "Late-night safety & 24/7 food access",
  },
];

export function PersonaSelector() {
  const { selectedProfile, setSelectedProfile, isLoading } = useSearchStore();

  return (
    <div className={styles.container}>
      <div className={styles.labelRow}>
        <span className={styles.sectionLabel}>Scoring Persona</span>
        <span className={styles.activeHint}>
          {PERSONAS.find((p) => p.id === selectedProfile)?.hint}
        </span>
      </div>
      <div className={styles.scrollTrack}>
        {PERSONAS.map((persona) => {
          const isActive = selectedProfile === persona.id;
          return (
            <button
              key={persona.id}
              type="button"
              className={`${styles.personaBtn} ${isActive ? styles.activeBtn : ""}`}
              onClick={() => setSelectedProfile(persona.id)}
              disabled={isLoading}
            >
              <span className={styles.iconWrapper}>{persona.icon}</span>
              <span className={styles.btnLabel}>{persona.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activePersonaPill"
                  className={styles.activeGlow}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
