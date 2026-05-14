from app.models.ai import AIRecommendation, RecommendationScore


class RecommendationEngine:
    def rank(self, properties: list[dict], localities_by_id: dict[str, dict], preferences: list[str], budget_max: int | None) -> list[AIRecommendation]:
        recommendations: list[AIRecommendation] = []
        for item in properties:
            locality = localities_by_id.get(item["locality_id"], {})
            scores = locality.get("scores", {})
            affordability = self._affordability(item["rent"], budget_max)
            commute = self._normalize_inverse(item.get("commute_estimate_minutes") or 45, 90)
            safety = float(scores.get("overall", 65))
            internet = float(scores.get("internet", 65))
            food_access = float(scores.get("food_access", 65))
            lifestyle_fit = self._lifestyle_fit(item, locality, preferences)
            total = (
                affordability * 0.24
                + commute * 0.24
                + safety * 0.2
                + internet * 0.14
                + food_access * 0.1
                + lifestyle_fit * 0.08
            )
            score = RecommendationScore(
                affordability=round(affordability, 1),
                commute=round(commute, 1),
                safety=round(safety, 1),
                internet=round(internet, 1),
                food_access=round(food_access, 1),
                lifestyle_fit=round(lifestyle_fit, 1),
                total=round(total, 1),
                explanation=self._explain(item, locality, total),
            )
            recommendations.append(
                AIRecommendation(
                    entity_type="property",
                    entity_id=str(item["_id"]),
                    title=item["title"],
                    locality_name=locality.get("name"),
                    score=score,
                    highlights=self._highlights(item, locality),
                    tradeoffs=self._tradeoffs(item, locality),
                )
            )
        return sorted(recommendations, key=lambda recommendation: recommendation.score.total, reverse=True)

    def _affordability(self, rent: int, budget_max: int | None) -> float:
        if not budget_max:
            return 70
        if rent <= budget_max:
            return min(100, 70 + ((budget_max - rent) / budget_max) * 30)
        return max(0, 70 - ((rent - budget_max) / budget_max) * 100)

    def _normalize_inverse(self, value: int, worst: int) -> float:
        return max(0, min(100, 100 - (value / worst) * 100))

    def _lifestyle_fit(self, item: dict, locality: dict, preferences: list[str]) -> float:
        text = " ".join(item.get("amenities", []) + locality.get("tags", [])).lower()
        if not preferences:
            return 70
        matches = sum(1 for preference in preferences if any(word in text for word in preference.split()))
        return min(100, 55 + matches * 15)

    def _explain(self, item: dict, locality: dict, total: float) -> str:
        return f"{item['title']} scores {round(total, 1)} because it balances rent, commute, and {locality.get('name', 'locality')} livability."

    def _highlights(self, item: dict, locality: dict) -> list[str]:
        highlights = [f"Rent around Rs {item['rent']:,}"]
        if item.get("nearby_metro"):
            highlights.append(f"Near {item['nearby_metro']} metro")
        if locality.get("scores", {}).get("internet", 0) >= 80:
            highlights.append("Strong internet reliability")
        return highlights

    def _tradeoffs(self, item: dict, locality: dict) -> list[str]:
        tradeoffs = []
        if (item.get("commute_estimate_minutes") or 0) > 40:
            tradeoffs.append("Commute can stretch during peak hours")
        if locality.get("scores", {}).get("late_night", 100) < 70:
            tradeoffs.append("Late-night safety needs extra care")
        return tradeoffs
