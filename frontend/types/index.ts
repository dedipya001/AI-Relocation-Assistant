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
  essentials: Array<{ name: string; category: string; distance_meters: number; rating?: number }>;
  things_to_do: Array<{ name: string; category: string; distance_meters: number; rating?: number }>;
};

export type Property = {
  _id: string;
  title: string;
  source_platform: string;
  source_url?: string;
  property_type: string;
  rent: number;
  deposit?: number;
  area_sqft?: number;
  furnishing?: string;
  images: string[];
  amenities: string[];
  location?: { type: "Point"; coordinates: [number, number] };
  locality_id: string;
  nearby_metro?: string;
  commute_estimate_minutes?: number;
  lowest_price?: { source: string; rent: number; url?: string };
  distance_to_office_km?: number;
  city?: string;
  locality?: string;
};

export type Recommendation = {
  entity_type: string;
  entity_id: string;
  title: string;
  locality_name?: string;
  score: {
    affordability: number;
    commute: number;
    safety: number;
    internet: number;
    food_access: number;
    lifestyle_fit: number;
    total: number;
    explanation: string;
  };
  highlights: string[];
  tradeoffs: string[];
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
