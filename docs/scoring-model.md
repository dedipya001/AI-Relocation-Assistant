# Recommendation Ranking & Explainable Scoring Model

This document specifies the mathematical foundation, weighting algorithms, constraint systems, and explainability mechanisms powering the AI Relocation Intelligence recommendation engine.

---

## 1. Overview & Core Philosophy

Relocation decisions are multi-criteria optimization problems. Rather than relying entirely on black-box LLM text outputs, the platform uses a **deterministic, multi-factor scoring engine** layered underneath natural language interfaces:

1. **Deterministic & Testable**: Recommendations have exact mathematical scores that are reproducible and unit-testable.
2. **Explainable & Transparent**: Every recommendation returns an itemized `subscores` breakdown exposing raw scores, weights, contributions, and human-readable explanations.
3. **User Persona Adaptive**: Scoring weights dynamically configure to match user priorities (e.g. tech workers prioritizing commute and fiber internet vs families prioritizing space and safety).
4. **Hard Constraint Enforcement**: Strict boundaries (e.g., maximum budget caps, mandatory lifts/amenities) strictly separate eligible properties from penalized or disqualified options.

---

## 2. Mathematical Scoring Architecture

The total composite score $S \in [0, 100]$ for a property $p$ in locality $L$ is defined as:

$$S(p, L) = \max\left(0, \min\left(100, \sum_{i=1}^N \left(w_i \cdot s_i\right) - \sum_{j=1}^M P_j\right)\right)$$

Where:
- $s_i \in [0, 100]$ is the sub-score for factor $i$.
- $w_i \in [0, 1]$ is the normalized weight for factor $i$ such that $\sum_{i=1}^N w_i = 1.0$.
- $P_j$ are penalty points deducted for hard constraint violations.

---

## 3. Sub-score Formulations

### 3.1 Affordability ($s_{\text{affordability}}$)

Evaluates the listing rent $R$ against the user's budget cap $B$:

- **When budget cap $B$ is specified**:
  - If $R \le B$:
    $$s_{\text{affordability}} = \min\left(100, 70 + \left(\frac{B - R}{B}\right) \times 40\right)$$
  - If $R > B$:
    $$s_{\text{affordability}} = \max\left(0, 70 - \left(\frac{R - B}{B}\right) \times 140\right)$$
- **When no budget cap is specified**: Evaluated against city-wide benchmark $R_{\text{ref}} = \text{Rs } 35,000$:
  $$s_{\text{affordability}} = \max\left(50, \min\left(95, 100 - \left\lfloor \frac{R}{R_{\text{ref}}} \times 50 \right\rfloor\right)\right)$$

### 3.2 Commute & Proximity ($s_{\text{commute}}$)

Evaluates estimated one-way travel time $T$ (in minutes) to the user's workplace or primary anchor location:

$$s_{\text{commute}} = \begin{cases} 
100 & \text{if } T \le 10 \\
100 - \left(\frac{T - 10}{50}\right) \times 55 & \text{if } 10 < T \le 60 \\
\max\left(0, 45 - \left(\frac{T - 60}{40}\right) \times 45\right) & \text{if } T > 60
\end{cases}$$

### 3.3 Neighbourhood Safety ($s_{\text{safety}}$)

Safety is a tri-factor composite computed from locality metrics:
- $S_{\text{overall}}$: General locality safety and street lighting.
- $S_{\text{women}}$: Women safety perceptions and commercial surveillance.
- $S_{\text{night}}$: Late-night safety and patrol frequency.

$$s_{\text{safety}} = \begin{cases}
0.45 \cdot S_{\text{women}} + 0.35 \cdot S_{\text{overall}} + 0.20 \cdot S_{\text{night}} & \text{for } \texttt{safety\_priority} \text{ and } \texttt{family\_first} \\
0.45 \cdot S_{\text{night}} + 0.35 \cdot S_{\text{overall}} + 0.20 \cdot S_{\text{women}} & \text{for } \texttt{night\_owl} \\
0.40 \cdot S_{\text{overall}} + 0.35 \cdot S_{\text{women}} + 0.25 \cdot S_{\text{night}} & \text{for standard/balanced profiles}
\end{cases}$$

### 3.4 Internet Connectivity ($s_{\text{internet}}$)

Combines locality broadband reliability $I_{\text{locality}}$ with listing-level fiber/wifi amenity tags:

$$s_{\text{internet}} = \min\left(100, I_{\text{locality}} + \Delta_{\text{fiber}}\right)$$

Where $\Delta_{\text{fiber}} = +8$ if the listing includes verified broadband, fiber, or wifi amenities.

### 3.5 Food & Daily Essentials ($s_{\text{food\_access}}$)

$$s_{\text{food\_access}} = \min\left(100, F_{\text{locality}} + \Delta_{\text{grocery}}\right)$$

Where $\Delta_{\text{grocery}} = +5$ if verified grocery stores or local markets are within $1.2\text{ km}$.

### 3.6 Lifestyle Fit ($s_{\text{lifestyle\_fit}}$)

Calculates the semantic overlap between user preference tags $U = \{u_1, u_2, \dots, u_K\}$ and property/locality tags $T$:

$$s_{\text{lifestyle\_fit}} = 50 + \left(\frac{|U \cap T|}{|U|}\right) \times 50$$

If no preferences are specified, a neutral score of $70$ is assigned.

### 3.7 Property Quality & Space ($s_{\text{property\_quality}}$)

Combines carpet area, furnishing tier, and price verification:
- **Base**: $65$
- **Area Bonus**: $+15$ if $\ge 600\text{ sqft}$, $+8$ if $\ge 300\text{ sqft}$.
- **Furnishing**: Fully furnished ($+12$), Semi-furnished ($+6$), Unfurnished ($+0$).
- **Multi-Source Price Verification**: $+8$ if tracked across multiple listing portals.

---

## 4. Configurable Scoring Profiles & Personas

Users can select from pre-configured relocation personas or provide arbitrary custom weight overrides:

| Profile | Affordability | Commute | Safety | Internet | Food Access | Lifestyle Fit | Property Quality |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `balanced` | **0.22** | **0.22** | **0.20** | **0.14** | **0.10** | **0.07** | **0.05** |
| `budget_saver` | **0.40** | 0.15 | 0.15 | 0.12 | 0.08 | 0.05 | 0.05 |
| `tech_professional` | 0.15 | **0.30** | 0.12 | **0.25** | 0.05 | 0.08 | 0.05 |
| `safety_priority` | 0.16 | 0.20 | **0.38** | 0.10 | 0.08 | 0.05 | 0.03 |
| `family_first` | 0.20 | 0.10 | **0.30** | 0.05 | 0.15 | 0.00 | **0.20** |
| `night_owl` | 0.10 | **0.24** | **0.26** | 0.15 | **0.20** | 0.05 | 0.00 |

### Weight Normalization Algorithm
When custom weights $\mathbf{w}_{\text{raw}}$ are submitted, the engine normalizes them:

$$w_i = \frac{w_{\text{raw}, i}}{\sum_{k=1}^N w_{\text{raw}, k}}$$

---

## 5. Hard Constraints Engine

Hard constraints allow users to set non-negotiable boundaries:

| Constraint | Violation Condition | Penalty Points ($P_j$) | Effect |
|---|---|:---:|---|
| `max_budget` | $\text{Rent} > \text{max\_budget}$ | $35$ | Marked `is_eligible = false` |
| `max_commute_minutes` | $\text{Commute} > \text{max\_commute\_minutes}$ | $25$ | Marked `is_eligible = false` |
| `min_safety_score` | $s_{\text{safety}} < \text{min\_safety\_score}$ | $25$ | Marked `is_eligible = false` |
| `min_internet_score` | $s_{\text{internet}} < \text{min\_internet\_score}$ | $20$ | Marked `is_eligible = false` |
| `must_have_amenities` | Property lacks any required amenity | $15$ per missing | Marked `is_eligible = false` |
| `allowed_property_types`| Property type not in whitelist | $30$ | Marked `is_eligible = false` |

Eligible properties are strictly ranked above ineligible ones.

---

## 6. Granular API Response Breakdown

Every recommendation returned by `POST /api/v1/search` and `POST /api/v1/recommendations/rank` includes full explainability fields:

```json
{
  "rank": 1,
  "entity_type": "property",
  "entity_id": "prop-tech-studio",
  "title": "High-Tech Studio near Metro",
  "locality_name": "Sector V",
  "is_eligible": true,
  "scoring_profile": "tech_professional",
  "score": {
    "total": 91.7,
    "confidence_score": 85,
    "explanation": "High-Tech Studio near Metro achieved an overall score of 91.7/100 under the TECH PROFESSIONAL profile, primarily driven by strong commute & proximity (100/100) and internet & connectivity (94/100) in Sector V.",
    "subscores": {
      "affordability": {
        "score": 82.0,
        "weight": 0.15,
        "contribution": 12.3,
        "label": "Affordability & Budget Fit",
        "details": "Rent is 30% under your max budget cap of Rs 20,000."
      },
      "commute": {
        "score": 100.0,
        "weight": 0.30,
        "contribution": 30.0,
        "label": "Commute & Proximity",
        "details": "Estimated 8 mins travel time to primary destination."
      },
      "internet": {
        "score": 94.0,
        "weight": 0.25,
        "contribution": 23.5,
        "label": "Internet & Connectivity",
        "details": "Locality benchmark (86/100) + verified in-building broadband/wifi tag."
      }
    }
  },
  "highlights": [
    "Rent at Rs 14,000/month",
    "Quick 8-minute commute to office",
    "Excellent fiber & high-speed internet reliability"
  ],
  "tradeoffs": [],
  "constraint_violations": []
}
```

---

## 7. Limitations & Bias Mitigation

### 7.1 Data Limitations
1. **OpenStreetMap POI Density Bias**: High-density urban commercial hubs (e.g. Sector V) naturally have more mapped POIs than quiet suburban residential zones. To mitigate this, scores are calibrated with baseline locality minimums rather than purely counting raw POI frequencies.
2. **Crowdsourced Rent Variances**: Negotiated rent feedback may have regional sample size variance. The system attaches a `confidence_score` reflecting observation density.
3. **Geocoding Approximations**: When exact building polygons are unmapped, distance calculations use the centroid of the locality or nearest landmark with a commute buffer.

### 7.2 Bias Mitigation & Fair Recommendations
1. **No Demographic Profiling**: Scoring factors strictly measure physical, financial, and logistical criteria (distance, rent, civic amenities, internet speeds) without using demographic, ethnic, or socio-economic profiling.
2. **User Autonomy & Overrides**: Users have full control to inspect `subscores`, adjust weights, or enforce hard constraints according to their personal relocation needs.
3. **Transparent Tradeoffs**: The engine explicitly surfaces potential drawbacks (e.g. peak-hour traffic bottlenecks, quiet late-night areas) alongside positive highlights.
