import {
  AIRecommendation,
  HardConstraints,
  PenaltyDetail,
  RecommendationScore,
  ScoringProfile,
  ScoringWeights,
  SubScoreDetail,
} from "../models/ai.js";

export const SCORING_PROFILE_PRESETS: Record<ScoringProfile, ScoringWeights> = {
  balanced: {
    affordability: 0.22,
    commute: 0.22,
    safety: 0.20,
    internet: 0.14,
    food_access: 0.10,
    lifestyle_fit: 0.07,
    property_quality: 0.05,
  },
  budget_saver: {
    affordability: 0.40,
    commute: 0.15,
    safety: 0.15,
    internet: 0.12,
    food_access: 0.08,
    lifestyle_fit: 0.05,
    property_quality: 0.05,
  },
  tech_professional: {
    commute: 0.30,
    internet: 0.25,
    affordability: 0.15,
    safety: 0.12,
    lifestyle_fit: 0.08,
    property_quality: 0.05,
    food_access: 0.05,
  },
  safety_priority: {
    safety: 0.38,
    commute: 0.20,
    affordability: 0.16,
    internet: 0.10,
    food_access: 0.08,
    lifestyle_fit: 0.05,
    property_quality: 0.03,
  },
  family_first: {
    safety: 0.30,
    property_quality: 0.20,
    affordability: 0.20,
    food_access: 0.15,
    commute: 0.10,
    internet: 0.05,
    lifestyle_fit: 0.00,
  },
  night_owl: {
    safety: 0.26,
    commute: 0.24,
    food_access: 0.20,
    internet: 0.15,
    affordability: 0.10,
    lifestyle_fit: 0.05,
    property_quality: 0.00,
  },
  custom: {
    affordability: 0.22,
    commute: 0.22,
    safety: 0.20,
    internet: 0.14,
    food_access: 0.10,
    lifestyle_fit: 0.07,
    property_quality: 0.05,
  },
};

export interface RankOptions {
  profile?: ScoringProfile;
  customWeights?: Partial<ScoringWeights>;
  hardConstraints?: Partial<HardConstraints>;
  preferences?: string[];
  budgetMax?: number | null;
}

export class RecommendationEngine {
  rank(
    properties: Record<string, any>[],
    localitiesById: Record<string, Record<string, any>>,
    preferences: string[] = [],
    budgetMax?: number | null,
    options: Partial<RankOptions> = {}
  ): AIRecommendation[] {
    const profile: ScoringProfile = options.profile || "balanced";
    const baseWeights = SCORING_PROFILE_PRESETS[profile] || SCORING_PROFILE_PRESETS.balanced;
    const resolvedWeights = this.normalizeWeights({
      ...baseWeights,
      ...(options.customWeights || {}),
    });

    const hardConstraints = options.hardConstraints || (budgetMax ? { max_budget: budgetMax } : {});
    const effectivePreferences = options.preferences || preferences;
    const effectiveBudgetMax = hardConstraints.max_budget ?? budgetMax ?? null;

    const recommendations: AIRecommendation[] = properties.map((item) => {
      const locality = localitiesById[item.locality_id] || {};
      const localityScores = locality.scores || {};

      // 1. Calculate Individual Sub-scores (0 - 100)
      const affordabilityCalc = this.calculateAffordability(item.rent, effectiveBudgetMax);
      const commuteCalc = this.calculateCommute(item.commute_estimate_minutes ?? 45);
      const safetyCalc = this.calculateSafety(localityScores, profile);
      const internetCalc = this.calculateInternet(localityScores, item.amenities || []);
      const foodAccessCalc = this.calculateFoodAccess(localityScores, locality.essentials || []);
      const lifestyleFitCalc = this.calculateLifestyleFit(item, locality, effectivePreferences);
      const propertyQualityCalc = this.calculatePropertyQuality(item);

      // 2. Build SubScores Map with Weights and Contributions
      const subscores: Record<string, SubScoreDetail> = {
        affordability: {
          score: affordabilityCalc.score,
          weight: resolvedWeights.affordability,
          contribution: Number((affordabilityCalc.score * resolvedWeights.affordability).toFixed(2)),
          label: "Affordability & Budget Fit",
          details: affordabilityCalc.details,
        },
        commute: {
          score: commuteCalc.score,
          weight: resolvedWeights.commute,
          contribution: Number((commuteCalc.score * resolvedWeights.commute).toFixed(2)),
          label: "Commute & Proximity",
          details: commuteCalc.details,
        },
        safety: {
          score: safetyCalc.score,
          weight: resolvedWeights.safety,
          contribution: Number((safetyCalc.score * resolvedWeights.safety).toFixed(2)),
          label: "Neighbourhood Safety",
          details: safetyCalc.details,
        },
        internet: {
          score: internetCalc.score,
          weight: resolvedWeights.internet,
          contribution: Number((internetCalc.score * resolvedWeights.internet).toFixed(2)),
          label: "Internet & Connectivity",
          details: internetCalc.details,
        },
        food_access: {
          score: foodAccessCalc.score,
          weight: resolvedWeights.food_access,
          contribution: Number((foodAccessCalc.score * resolvedWeights.food_access).toFixed(2)),
          label: "Food & Daily Essentials",
          details: foodAccessCalc.details,
        },
        lifestyle_fit: {
          score: lifestyleFitCalc.score,
          weight: resolvedWeights.lifestyle_fit,
          contribution: Number((lifestyleFitCalc.score * resolvedWeights.lifestyle_fit).toFixed(2)),
          label: "Lifestyle Preferences",
          details: lifestyleFitCalc.details,
        },
        property_quality: {
          score: propertyQualityCalc.score,
          weight: resolvedWeights.property_quality,
          contribution: Number((propertyQualityCalc.score * resolvedWeights.property_quality).toFixed(2)),
          label: "Property & Amenities Quality",
          details: propertyQualityCalc.details,
        },
      };

      // 3. Raw Weighted Sum
      let rawTotal = Object.values(subscores).reduce((sum, s) => sum + s.contribution, 0);

      // 4. Hard Constraints Evaluation & Penalties
      const { violations, penalties } = this.evaluateHardConstraints(
        item,
        locality,
        subscores,
        hardConstraints
      );

      const penaltySum = penalties.reduce((sum, p) => sum + p.penalty_points, 0);
      const totalScore = Math.max(0, Math.min(100, Number((rawTotal - penaltySum).toFixed(1))));

      // 5. Confidence Score
      const confidenceScore = this.calculateConfidence(item, locality);

      // 6. Explainability Narrative & Highlights
      const highlights = this.generateHighlights(item, locality, subscores);
      const tradeoffs = this.generateTradeoffs(item, locality, subscores, violations);
      const explanation = this.generateExplanation(item, locality, totalScore, subscores, profile);

      const scoreResult: RecommendationScore = {
        affordability: affordabilityCalc.score,
        commute: commuteCalc.score,
        safety: safetyCalc.score,
        internet: internetCalc.score,
        food_access: foodAccessCalc.score,
        lifestyle_fit: lifestyleFitCalc.score,
        property_quality: propertyQualityCalc.score,
        total: totalScore,
        confidence_score: confidenceScore,
        explanation,
        subscores,
        penalties,
      };

      return {
        entity_type: "property",
        entity_id: String(item._id),
        title: item.title,
        locality_name: locality.name || null,
        score: scoreResult,
        highlights,
        tradeoffs,
        constraint_violations: violations,
        scoring_profile: profile,
        is_eligible: violations.length === 0,
      };
    });

    // Rank: Eligible properties first by total score descending, followed by penalized/ineligible ones
    recommendations.sort((a, b) => {
      if (a.is_eligible !== b.is_eligible) {
        return a.is_eligible ? -1 : 1;
      }
      return b.score.total - a.score.total;
    });

    // Assign 1-indexed ranks
    recommendations.forEach((rec, idx) => {
      rec.rank = idx + 1;
    });

    return recommendations;
  }

  // --- Normalization Helpers ---

  normalizeWeights(weights: ScoringWeights): ScoringWeights {
    const sum =
      weights.affordability +
      weights.commute +
      weights.safety +
      weights.internet +
      weights.food_access +
      weights.lifestyle_fit +
      weights.property_quality;

    if (sum <= 0) {
      return SCORING_PROFILE_PRESETS.balanced;
    }

    return {
      affordability: Number((weights.affordability / sum).toFixed(4)),
      commute: Number((weights.commute / sum).toFixed(4)),
      safety: Number((weights.safety / sum).toFixed(4)),
      internet: Number((weights.internet / sum).toFixed(4)),
      food_access: Number((weights.food_access / sum).toFixed(4)),
      lifestyle_fit: Number((weights.lifestyle_fit / sum).toFixed(4)),
      property_quality: Number((weights.property_quality / sum).toFixed(4)),
    };
  }

  // --- Sub-score Calculation Methods ---

  calculateAffordability(rent: number, budgetMax?: number | null): { score: number; details: string } {
    if (!budgetMax || budgetMax <= 0) {
      const score = Math.max(50, Math.min(95, 100 - Math.floor((rent / 35000) * 50)));
      return {
        score: Number(score.toFixed(1)),
        details: `Rent Rs ${rent.toLocaleString("en-IN")}/mo evaluated against general market benchmarks.`,
      };
    }

    if (rent <= budgetMax) {
      const savingsRatio = (budgetMax - rent) / budgetMax;
      const score = Math.min(100, 70 + savingsRatio * 40);
      const savingsPct = Math.round(savingsRatio * 100);
      return {
        score: Number(score.toFixed(1)),
        details:
          savingsPct > 0
            ? `Rent is ${savingsPct}% under your max budget cap of Rs ${budgetMax.toLocaleString("en-IN")}.`
            : `Rent exactly matches your max budget of Rs ${budgetMax.toLocaleString("en-IN")}.`,
      };
    }

    const overageRatio = (rent - budgetMax) / budgetMax;
    const score = Math.max(0, 70 - overageRatio * 140);
    const overPct = Math.round(overageRatio * 100);
    return {
      score: Number(score.toFixed(1)),
      details: `Rent exceeds budget cap by ${overPct}% (Rs ${rent.toLocaleString("en-IN")} vs Rs ${budgetMax.toLocaleString("en-IN")}).`,
    };
  }

  calculateCommute(minutes: number): { score: number; details: string } {
    let score: number;
    if (minutes <= 10) {
      score = 100;
    } else if (minutes <= 60) {
      score = 100 - ((minutes - 10) / 50) * 55; // 100 down to 45
    } else {
      score = Math.max(0, 45 - ((minutes - 60) / 40) * 45);
    }

    return {
      score: Number(score.toFixed(1)),
      details: `Estimated ${minutes} mins travel time to primary destination.`,
    };
  }

  calculateSafety(
    scores: Record<string, number>,
    profile: ScoringProfile
  ): { score: number; details: string } {
    const overall = Number(scores.overall ?? 68);
    const womenSafety = Number(scores.women_safety ?? overall);
    const lateNight = Number(scores.late_night ?? overall - 5);

    let composite: number;
    if (profile === "safety_priority" || profile === "family_first") {
      composite = womenSafety * 0.45 + overall * 0.35 + lateNight * 0.2;
    } else if (profile === "night_owl") {
      composite = lateNight * 0.45 + overall * 0.35 + womenSafety * 0.2;
    } else {
      composite = overall * 0.4 + womenSafety * 0.35 + lateNight * 0.25;
    }

    const clamped = Math.max(0, Math.min(100, composite));
    return {
      score: Number(clamped.toFixed(1)),
      details: `Safety score based on locality metrics (Overall: ${overall}, Women Safety: ${womenSafety}, Late Night: ${lateNight}).`,
    };
  }

  calculateInternet(
    localityScores: Record<string, number>,
    amenities: string[]
  ): { score: number; details: string } {
    const base = Number(localityScores.internet ?? 70);
    const lowerAmenities = amenities.map((a) => a.toLowerCase());
    const hasFiber = lowerAmenities.some((a) => a.includes("wifi") || a.includes("internet") || a.includes("fiber"));
    const bonus = hasFiber ? 8 : 0;
    const finalScore = Math.min(100, base + bonus);

    return {
      score: Number(finalScore.toFixed(1)),
      details: hasFiber
        ? `Locality benchmark (${base}/100) + verified in-building broadband/wifi tag.`
        : `Locality broadband & cellular infrastructure rating (${base}/100).`,
    };
  }

  calculateFoodAccess(
    localityScores: Record<string, number>,
    essentials: any[]
  ): { score: number; details: string } {
    const base = Number(localityScores.food_access ?? 70);
    const hasGrocery = essentials.some(
      (e) => (e.category === "grocery" || e.category === "market") && (e.distance_meters || 9999) <= 1200
    );
    const bonus = hasGrocery ? 5 : 0;
    const score = Math.min(100, base + bonus);

    return {
      score: Number(score.toFixed(1)),
      details: hasGrocery
        ? `High dining & grocery density with markets within 1.2km (${score}/100).`
        : `Neighbourhood food access and delivery availability (${score}/100).`,
    };
  }

  calculateLifestyleFit(
    item: Record<string, any>,
    locality: Record<string, any>,
    preferences: string[]
  ): { score: number; details: string } {
    if (!preferences || preferences.length === 0) {
      return { score: 70, details: "No specific lifestyle preferences specified (neutral default)." };
    }

    const itemText = `${(item.amenities || []).join(" ")} ${(locality.tags || []).join(" ")} ${item.property_type || ""}`.toLowerCase();
    const matchedPreferences: string[] = [];

    for (const pref of preferences) {
      const words = pref.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0 && words.some((word) => itemText.includes(word))) {
        matchedPreferences.push(pref);
      }
    }

    const matchRatio = matchedPreferences.length / preferences.length;
    const score = Math.min(100, 50 + matchRatio * 50);

    return {
      score: Number(score.toFixed(1)),
      details:
        matchedPreferences.length > 0
          ? `Matches ${matchedPreferences.length}/${preferences.length} preferences: [${matchedPreferences.join(", ")}].`
          : `Did not directly match specified preferences: [${preferences.join(", ")}].`,
    };
  }

  calculatePropertyQuality(item: Record<string, any>): { score: number; details: string } {
    let score = 65;
    const details: string[] = [];

    const area = Number(item.area_sqft || 0);
    if (area >= 600) {
      score += 15;
      details.push(`Spacious floor plan (${area} sqft)`);
    } else if (area >= 300) {
      score += 8;
      details.push(`Standard floor plan (${area} sqft)`);
    }

    const furnishing = String(item.furnishing || "").toLowerCase();
    if (furnishing.includes("furnished") && !furnishing.includes("semi") && !furnishing.includes("un")) {
      score += 12;
      details.push("Fully furnished");
    } else if (furnishing.includes("semi")) {
      score += 6;
      details.push("Semi-furnished");
    }

    if (item.lowest_price && item.price_history && item.price_history.length > 1) {
      score += 8;
      details.push("Multi-source price tracked");
    }

    const finalScore = Math.max(40, Math.min(100, score));
    return {
      score: finalScore,
      details: details.length > 0 ? details.join(", ") : "Standard property layout and amenities.",
    };
  }

  // --- Hard Constraints & Confidence ---

  evaluateHardConstraints(
    item: Record<string, any>,
    locality: Record<string, any>,
    subscores: Record<string, SubScoreDetail>,
    constraints: Partial<HardConstraints>
  ): { violations: string[]; penalties: PenaltyDetail[] } {
    const violations: string[] = [];
    const penalties: PenaltyDetail[] = [];

    if (constraints.max_budget && item.rent > constraints.max_budget) {
      violations.push(`Rent (Rs ${item.rent}) exceeds hard maximum budget of Rs ${constraints.max_budget}`);
      penalties.push({ reason: "Hard budget ceiling exceeded", penalty_points: 35 });
    }

    if (constraints.max_commute_minutes && (item.commute_estimate_minutes || 45) > constraints.max_commute_minutes) {
      violations.push(
        `Commute time (${item.commute_estimate_minutes} mins) exceeds maximum constraint of ${constraints.max_commute_minutes} mins`
      );
      penalties.push({ reason: "Hard commute limit exceeded", penalty_points: 25 });
    }

    if (constraints.min_safety_score && subscores.safety.score < constraints.min_safety_score) {
      violations.push(
        `Safety score (${subscores.safety.score}) is below minimum required threshold of ${constraints.min_safety_score}`
      );
      penalties.push({ reason: "Safety score below minimum", penalty_points: 25 });
    }

    if (constraints.min_internet_score && subscores.internet.score < constraints.min_internet_score) {
      violations.push(
        `Internet score (${subscores.internet.score}) is below minimum required threshold of ${constraints.min_internet_score}`
      );
      penalties.push({ reason: "Internet connectivity below required minimum", penalty_points: 20 });
    }

    if (constraints.must_have_amenities && constraints.must_have_amenities.length > 0) {
      const amenities = (item.amenities || []).map((a: string) => a.toLowerCase());
      for (const mustHave of constraints.must_have_amenities) {
        if (!amenities.some((a: string) => a.includes(mustHave.toLowerCase()))) {
          violations.push(`Missing mandatory amenity: ${mustHave}`);
          penalties.push({ reason: `Missing mandatory amenity '${mustHave}'`, penalty_points: 15 });
        }
      }
    }

    if (constraints.allowed_property_types && constraints.allowed_property_types.length > 0) {
      const pType = String(item.property_type || "").toLowerCase();
      const allowed = constraints.allowed_property_types.map((t) => t.toLowerCase());
      if (!allowed.some((a) => pType.includes(a))) {
        violations.push(`Property type '${item.property_type}' is not among allowed types [${constraints.allowed_property_types.join(", ")}]`);
        penalties.push({ reason: "Disallowed property type", penalty_points: 30 });
      }
    }

    return { violations, penalties };
  }

  calculateConfidence(item: Record<string, any>, locality: Record<string, any>): number {
    let score = 50;
    if (item.location?.coordinates && item.location.coordinates[0] !== 0) score += 15;
    if (locality && locality.scores) score += 15;
    if (item.price_history && item.price_history.length > 1) score += 10;
    if (item.images && item.images.length > 0) score += 5;
    if (item.source_url) score += 5;
    return Math.min(100, score);
  }

  // --- Highlights, Tradeoffs & Narratives ---

  generateHighlights(
    item: Record<string, any>,
    locality: Record<string, any>,
    subscores: Record<string, SubScoreDetail>
  ): string[] {
    const hl: string[] = [];

    // Rent
    hl.push(`Rent at Rs ${Number(item.rent || 0).toLocaleString("en-IN")}/month`);

    // Commute
    if (item.commute_estimate_minutes && item.commute_estimate_minutes <= 25) {
      hl.push(`Quick ${item.commute_estimate_minutes}-minute commute to office`);
    } else if (item.nearby_metro) {
      hl.push(`Connected via ${item.nearby_metro} metro`);
    }

    // Safety / Internet / Food highlights based on high subscores
    if (subscores.safety.score >= 78) {
      hl.push(`High safety rating (${subscores.safety.score}/100) in ${locality.name || "neighbourhood"}`);
    }
    if (subscores.internet.score >= 85) {
      hl.push("Excellent fiber & high-speed internet reliability");
    }
    if (subscores.food_access.score >= 85) {
      hl.push("Vibrant food and market access within walking distance");
    }

    return hl.slice(0, 4);
  }

  generateTradeoffs(
    item: Record<string, any>,
    locality: Record<string, any>,
    subscores: Record<string, SubScoreDetail>,
    violations: string[]
  ): string[] {
    const tradeoffs: string[] = [];

    if (violations.length > 0) {
      tradeoffs.push(...violations);
    }

    if ((item.commute_estimate_minutes || 0) >= 35) {
      tradeoffs.push(`Commute can extend to ${item.commute_estimate_minutes} mins during peak traffic hours`);
    }

    if (subscores.safety.score < 70) {
      tradeoffs.push("Late-night safety index indicates caution needed in quiet hours");
    }

    if (subscores.affordability.score < 60) {
      tradeoffs.push("Price sits at the upper tier of the requested budget target");
    }

    if (!item.furnishing || item.furnishing === "verification needed" || item.furnishing === "unfurnished") {
      tradeoffs.push("Furnishing status requires physical verification prior to lease");
    }

    return Array.from(new Set(tradeoffs)).slice(0, 4);
  }

  generateExplanation(
    item: Record<string, any>,
    locality: Record<string, any>,
    totalScore: number,
    subscores: Record<string, SubScoreDetail>,
    profile: ScoringProfile
  ): string {
    const profileLabel = profile.replace("_", " ").toUpperCase();
    const topFactors = Object.entries(subscores)
      .sort((a, b) => b[1].contribution - a[1].contribution)
      .slice(0, 2)
      .map(([_, data]) => `${data.label.toLowerCase()} (${data.score}/100)`);

    return `${item.title} achieved an overall score of ${totalScore}/100 under the ${profileLabel} profile, primarily driven by strong ${topFactors.join(" and ")} in ${locality.name || "the locality"}.`;
  }
}
