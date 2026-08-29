export type ScoreBundle = {
  overall: number;
  women_safety: number;
  late_night: number;
  internet: number;
  food_access: number;
  commute_reliability: number;
};

export type Locality = {
  _id: string;
  name: string;
  slug: string;
  city: string;
  summary: string;
  tags: string[];
  scores: ScoreBundle;
  coordinates?: [number, number];
  score?: number;
  metrics?: Record<string, any>;
  pros?: string[];
  cons?: string[];
  community_sentiment?: Record<string, any>;
  top_amenities?: string[];
  essentials: Array<{ name: string; category: string; distance_meters: number; rating?: number }>;
  things_to_do: Array<{ name: string; category: string; distance_meters: number; rating?: number }>;
};

export type Property = {
  _id: string;
  title: string;
  source_platform: string;
  source_url?: string | null;
  property_type: string;
  rent: number;
  deposit?: number | null;
  area_sqft?: number | null;
  furnishing?: string | null;
  images: string[];
  amenities: string[];
  location?: { type: "Point"; coordinates: [number, number] } | null;
  locality_id: string;
  nearby_metro?: string | null;
  commute_estimate_minutes?: number | null;
  lowest_price?: { source: string; rent: number; url?: string | null; observed_at?: string } | null;
  distance_to_office_km?: number | null;
  city?: string | null;
  locality?: string | null;
};

export type ScoringProfile =
  | "balanced"
  | "budget_saver"
  | "tech_professional"
  | "safety_priority"
  | "family_first"
  | "night_owl"
  | "custom";

export type ScoringWeights = {
  affordability: number;
  commute: number;
  safety: number;
  internet: number;
  food_access: number;
  lifestyle_fit: number;
  property_quality: number;
};

export type HardConstraints = {
  max_budget?: number | null;
  max_commute_minutes?: number | null;
  min_safety_score?: number | null;
  min_internet_score?: number | null;
  min_food_access_score?: number | null;
  must_have_amenities?: string[];
  allowed_property_types?: string[];
};

export type SubScoreDetail = {
  score: number;
  weight: number;
  contribution: number;
  label: string;
  details: string;
};

export type RecommendationScore = {
  affordability: number;
  commute: number;
  safety: number;
  internet: number;
  food_access: number;
  lifestyle_fit: number;
  property_quality?: number;
  total: number;
  confidence_score?: number;
  explanation: string;
  subscores?: Record<string, SubScoreDetail>;
  penalties?: Array<{ reason: string; penalty_points: number }>;
};

export type Recommendation = {
  rank?: number;
  entity_type: string;
  entity_id: string;
  title: string;
  locality_name?: string | null;
  score: RecommendationScore;
  highlights: string[];
  tradeoffs: string[];
  constraint_violations?: string[];
  scoring_profile?: string;
  is_eligible?: boolean;
};

export type SearchResponse = {
  intent: {
    query: string;
    filters: {
      office_location?: string;
      budget_max?: number;
      property_types: string[];
      preferences: string[];
      transport_modes: string[];
    };
    inferred_lifestyle: string[];
    follow_up_questions: string[];
  };
  recommendations: Recommendation[];
  properties: Property[];
  office_coordinates?: [number, number] | null;
};

export type CommuteEstimate = {
  mode: string;
  minutes: number;
  monthly_cost: number;
  reliability_score: number;
  peak_delay_minutes: number;
  route_summary: string;
};
