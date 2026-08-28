import { AIRecommendation, RecommendationScore } from "../models/ai.js";

export class RecommendationEngine {
  rank(
    properties: Record<string, any>[],
    localitiesById: Record<string, Record<string, any>>,
    preferences: string[],
    budgetMax?: number | null
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = properties.map((item) => {
      const locality = localitiesById[item.locality_id] || {};
      const scores = locality.scores || {};

      const affordability = this.affordability(item.rent, budgetMax);
      const commute = this.normalizeInverse(item.commute_estimate_minutes || 45, 90);
      const safety = Number(scores.overall ?? 65);
      const internet = Number(scores.internet ?? 65);
      const foodAccess = Number(scores.food_access ?? 65);
      const lifestyleFit = this.lifestyleFit(item, locality, preferences);

      const total =
        affordability * 0.24 +
        commute * 0.24 +
        safety * 0.2 +
        internet * 0.14 +
        foodAccess * 0.1 +
        lifestyleFit * 0.08;

      const score: RecommendationScore = {
        affordability: Number(affordability.toFixed(1)),
        commute: Number(commute.toFixed(1)),
        safety: Number(safety.toFixed(1)),
        internet: Number(internet.toFixed(1)),
        food_access: Number(foodAccess.toFixed(1)),
        lifestyle_fit: Number(lifestyleFit.toFixed(1)),
        total: Number(total.toFixed(1)),
        explanation: this.explain(item, locality, total),
      };

      return {
        entity_type: "property",
        entity_id: String(item._id),
        title: item.title,
        locality_name: locality.name || null,
        score,
        highlights: this.highlights(item, locality),
        tradeoffs: this.tradeoffs(item, locality),
      };
    });

    return recommendations.sort((a, b) => b.score.total - a.score.total);
  }

  private affordability(rent: number, budgetMax?: number | null): number {
    if (!budgetMax) {
      return 70;
    }
    if (rent <= budgetMax) {
      return Math.min(100, 70 + ((budgetMax - rent) / budgetMax) * 30);
    }
    return Math.max(0, 70 - ((rent - budgetMax) / budgetMax) * 100);
  }

  private normalizeInverse(value: number, worst: number): number {
    return Math.max(0, Math.min(100, 100 - (value / worst) * 100));
  }

  private lifestyleFit(
    item: Record<string, any>,
    locality: Record<string, any>,
    preferences: string[]
  ): number {
    const text = `${(item.amenities || []).join(" ")} ${(locality.tags || []).join(" ")}`.toLowerCase();
    if (!preferences || preferences.length === 0) {
      return 70;
    }
    const matches = preferences.filter((pref) =>
      pref.split(/\s+/).some((word) => text.includes(word.toLowerCase()))
    ).length;
    return Math.min(100, 55 + matches * 15);
  }

  private explain(item: Record<string, any>, locality: Record<string, any>, total: number): string {
    return `${item.title} scores ${total.toFixed(1)} because it balances rent, commute, and ${
      locality.name || "locality"
    } livability.`;
  }

  private highlights(item: Record<string, any>, locality: Record<string, any>): string[] {
    const hl = [`Rent around Rs ${item.rent?.toLocaleString("en-IN")}`];
    if (item.nearby_metro) {
      hl.push(`Near ${item.nearby_metro} metro`);
    }
    if (locality.scores && locality.scores.internet >= 80) {
      hl.push("Strong internet reliability");
    }
    return hl;
  }

  private tradeoffs(item: Record<string, any>, locality: Record<string, any>): string[] {
    const to: string[] = [];
    if ((item.commute_estimate_minutes || 0) > 40) {
      to.push("Commute can stretch during peak hours");
    }
    if (locality.scores && (locality.scores.late_night ?? 100) < 70) {
      to.push("Late-night safety needs extra care");
    }
    return to;
  }
}
