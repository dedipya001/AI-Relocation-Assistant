import { Injectable } from '@angular/core';
import type { Locality, Property, SearchResponse, Recommendation, RecommendationScore } from '../models/relocation.models';

// ─── Demo Localities ────────────────────────────────────────────────────────

export const demoLocalities: Locality[] = [
  {
    _id: 'loc-sector-v',
    name: 'Sector V, Salt Lake',
    slug: 'sector-v',
    city: 'Kolkata',
    summary: 'Major IT & tech hub (Millennium City, Godrej Waterside, DLF). Livability score 88/100.',
    tags: ['Metro Access', 'Fiber Internet', '24/7 Power', 'Food Hubs', 'Parks'],
    scores: { overall: 92, women_safety: 92, late_night: 87, internet: 96, food_access: 90, commute_reliability: 95 },
    coordinates: [88.4335, 22.5762],
    score: 88,
    pros: ['Major IT & tech hub', 'East-West Metro connectivity', 'High concentration of cafes', 'Stable electricity grid'],
    cons: ['Heavy rush hour traffic', 'Higher rental rates'],
    top_amenities: ['Metro Access', 'Fiber Internet', '24/7 Power', 'Food Hubs', 'Parks'],
    essentials: [
      { name: 'Supermarket & Groceries (Blinkit/Zepto Hub)', category: 'Daily Essentials', distance_meters: 250, rating: 4.8 },
      { name: 'Metro / Transit Stop', category: 'Transit', distance_meters: 600, rating: 4.5 },
      { name: 'Multi-specialty Hospital & Clinic', category: 'Healthcare', distance_meters: 800, rating: 4.3 },
      { name: 'Branded Cafe (Starbucks / Blue Tokai)', category: 'Cafe', distance_meters: 150, rating: 4.6 },
    ],
    things_to_do: [
      { name: 'City Centre 2 Mall', category: 'Shopping', distance_meters: 1200, rating: 4.4 },
      { name: 'Eco Park', category: 'Park', distance_meters: 2800, rating: 4.5 },
    ],
  },
  {
    _id: 'loc-new-town',
    name: 'New Town, Rajarhat',
    slug: 'new-town',
    city: 'Kolkata',
    summary: 'Planned township with wide roads, modern apartments, upcoming metro. Livability 84/100.',
    tags: ['Planned Township', 'Metro Upcoming', 'Wide Roads', 'New Apartments'],
    scores: { overall: 84, women_safety: 88, late_night: 82, internet: 90, food_access: 82, commute_reliability: 80 },
    coordinates: [88.4700, 22.5869],
    score: 84,
    pros: ['Well-planned infrastructure', 'Modern housing stock', 'Growing tech companies'],
    cons: ['Longer commute to Sector V', 'Fewer late-night options'],
    top_amenities: ['Wide Roads', 'New Apartments', 'Parks'],
    essentials: [
      { name: 'City Centre Mall', category: 'Shopping', distance_meters: 500, rating: 4.3 },
      { name: 'Apollo Clinic', category: 'Healthcare', distance_meters: 1200, rating: 4.2 },
    ],
    things_to_do: [
      { name: 'Eco Park', category: 'Park', distance_meters: 600, rating: 4.5 },
      { name: 'Biswa Bangla Gate', category: 'Landmark', distance_meters: 900, rating: 4.2 },
    ],
  },
  {
    _id: 'loc-lake-town',
    name: 'Lake Town',
    slug: 'lake-town',
    city: 'Kolkata',
    summary: 'Established residential neighbourhood with calm streets and good connectivity. Livability 76/100.',
    tags: ['Residential', 'Calm', 'Bus Routes', 'Markets'],
    scores: { overall: 76, women_safety: 80, late_night: 72, internet: 78, food_access: 84, commute_reliability: 74 },
    coordinates: [88.3900, 22.5950],
    score: 76,
    pros: ['Calm residential feel', 'Good local markets', 'Affordable rents'],
    cons: ['No direct metro', 'Longer commute to IT hub'],
    top_amenities: ['Residential', 'Markets', 'Bus Routes'],
    essentials: [
      { name: 'Local Market', category: 'Daily Essentials', distance_meters: 300, rating: 4.0 },
      { name: 'Bus Stop', category: 'Transit', distance_meters: 200, rating: 3.8 },
    ],
    things_to_do: [
      { name: 'Rabindra Sarobar', category: 'Park', distance_meters: 3500, rating: 4.6 },
    ],
  },
];

// ─── Demo Properties ─────────────────────────────────────────────────────────

export const demoProperties: Property[] = [
  {
    _id: 'prop-001',
    title: '2BHK Near Sector V Metro',
    source_platform: 'demo',
    property_type: '2BHK',
    rent: 18000,
    deposit: 54000,
    area_sqft: 850,
    furnishing: 'Semi-Furnished',
    images: [],
    amenities: ['high-speed internet', 'power backup', 'parking', '24/7 security'],
    location: { type: 'Point', coordinates: [88.4335, 22.5762] },
    locality_id: 'loc-sector-v',
    nearby_metro: 'Sector V Metro',
    commute_estimate_minutes: 8,
    distance_to_office_km: 1.2,
    city: 'Kolkata',
    locality: 'Sector V',
  },
  {
    _id: 'prop-002',
    title: 'Cozy 1BHK in New Town',
    source_platform: 'demo',
    property_type: '1BHK',
    rent: 12000,
    deposit: 36000,
    area_sqft: 550,
    furnishing: 'Fully Furnished',
    images: [],
    amenities: ['wifi', 'gym', 'security'],
    location: { type: 'Point', coordinates: [88.4720, 22.5880] },
    locality_id: 'loc-new-town',
    nearby_metro: 'New Town upcoming',
    commute_estimate_minutes: 28,
    distance_to_office_km: 5.8,
    city: 'Kolkata',
    locality: 'New Town',
  },
  {
    _id: 'prop-003',
    title: 'Spacious 3BHK, Lake Town',
    source_platform: 'demo',
    property_type: '3BHK',
    rent: 22000,
    deposit: 66000,
    area_sqft: 1100,
    furnishing: 'Semi-Furnished',
    images: [],
    amenities: ['parking', 'power backup', 'modular kitchen'],
    location: { type: 'Point', coordinates: [88.3910, 22.5960] },
    locality_id: 'loc-lake-town',
    nearby_metro: 'Noapara Metro',
    commute_estimate_minutes: 38,
    distance_to_office_km: 9.1,
    city: 'Kolkata',
    locality: 'Lake Town',
  },
  {
    _id: 'prop-004',
    title: 'Premium 2BHK, Sector V IT Park View',
    source_platform: 'demo',
    property_type: '2BHK',
    rent: 24000,
    deposit: 72000,
    area_sqft: 950,
    furnishing: 'Fully Furnished',
    images: [],
    amenities: ['high-speed internet', 'gym', 'pool', '24/7 security', 'parking'],
    location: { type: 'Point', coordinates: [88.4340, 22.5768] },
    locality_id: 'loc-sector-v',
    nearby_metro: 'Sector V Metro',
    commute_estimate_minutes: 5,
    distance_to_office_km: 0.6,
    city: 'Kolkata',
    locality: 'Sector V',
    lowest_price: { source: 'nobroker', rent: 22000 },
  },
  {
    _id: 'prop-005',
    title: 'Budget PG / 1RK, New Town',
    source_platform: 'demo',
    property_type: '1RK',
    rent: 8500,
    deposit: 17000,
    area_sqft: 280,
    furnishing: 'Fully Furnished',
    images: [],
    amenities: ['wifi', 'security'],
    location: { type: 'Point', coordinates: [88.4690, 22.5855] },
    locality_id: 'loc-new-town',
    commute_estimate_minutes: 32,
    distance_to_office_km: 6.5,
    city: 'Kolkata',
    locality: 'New Town',
  },
  {
    _id: 'prop-006',
    title: '2BHK with Balcony, Lake Town',
    source_platform: 'demo',
    property_type: '2BHK',
    rent: 14000,
    deposit: 42000,
    area_sqft: 780,
    furnishing: 'Semi-Furnished',
    images: [],
    amenities: ['parking', 'power backup'],
    location: { type: 'Point', coordinates: [88.3895, 22.5948] },
    locality_id: 'loc-lake-town',
    commute_estimate_minutes: 40,
    distance_to_office_km: 9.8,
    city: 'Kolkata',
    locality: 'Lake Town',
  },
];

// ─── Demo Search Response ─────────────────────────────────────────────────────

function makeScore(total: number, affordability: number, commute: number, safety: number): RecommendationScore {
  return {
    affordability, commute, safety,
    internet: 82, food_access: 80, lifestyle_fit: 78,
    total,
    confidence_score: 88,
    explanation: `Scored ${total}/100 based on commute efficiency, rent value, safety metrics, and lifestyle fit near your specified office.`,
    subscores: {
      affordability: { score: affordability, weight: 0.2, contribution: Math.round(affordability * 0.2), label: 'Affordability', details: 'Based on market rent vs budget.' },
      commute: { score: commute, weight: 0.25, contribution: Math.round(commute * 0.25), label: 'Commute Score', details: 'Peak-hour commute time to office.' },
      safety: { score: safety, weight: 0.2, contribution: Math.round(safety * 0.2), label: 'Safety Score', details: 'Women safety & late-night security.' },
      internet: { score: 82, weight: 0.15, contribution: 12, label: 'Internet Quality', details: 'Fiber broadband availability.' },
      food_access: { score: 80, weight: 0.1, contribution: 8, label: 'Food Access', details: 'Restaurants & delivery coverage.' },
      lifestyle_fit: { score: 78, weight: 0.1, contribution: 8, label: 'Lifestyle Fit', details: 'Cafes, parks, vibrancy.' },
    },
  };
}

const demoRecommendations: Recommendation[] = [
  { rank: 1, entity_type: 'property', entity_id: 'prop-001', title: '2BHK Near Sector V Metro', score: makeScore(89, 78, 94, 92), highlights: ['8 min commute to office', 'Fiber internet included', 'Safe neighbourhood'], tradeoffs: ['Slightly higher rent', 'Limited parking'], scoring_profile: 'balanced', is_eligible: true },
  { rank: 2, entity_type: 'property', entity_id: 'prop-004', title: 'Premium 2BHK, Sector V IT Park View', score: makeScore(86, 65, 97, 92), highlights: ['5 min walk to office', 'Full amenities', 'Pool & gym'], tradeoffs: ['Premium pricing', 'Higher deposit'], scoring_profile: 'balanced', is_eligible: true },
  { rank: 3, entity_type: 'property', entity_id: 'prop-002', title: 'Cozy 1BHK in New Town', score: makeScore(79, 92, 68, 88), highlights: ['Budget-friendly rent', 'Fully furnished', 'Planned township'], tradeoffs: ['28 min commute', 'Fewer late-night options'], scoring_profile: 'balanced', is_eligible: true },
  { rank: 4, entity_type: 'property', entity_id: 'prop-005', title: 'Budget PG / 1RK, New Town', score: makeScore(72, 98, 62, 84), highlights: ['Lowest rent option', 'Fully furnished'], tradeoffs: ['32 min commute', 'Small space'], scoring_profile: 'balanced', is_eligible: true },
  { rank: 5, entity_type: 'property', entity_id: 'prop-006', title: '2BHK with Balcony, Lake Town', score: makeScore(68, 86, 58, 80), highlights: ['Quiet residential feel', 'Balcony', 'Good local market'], tradeoffs: ['40 min commute', 'No direct metro'], scoring_profile: 'balanced', is_eligible: true },
  { rank: 6, entity_type: 'property', entity_id: 'prop-003', title: 'Spacious 3BHK, Lake Town', score: makeScore(65, 72, 54, 80), highlights: ['Largest space', 'Modular kitchen', 'Family-friendly'], tradeoffs: ['Longest commute', 'High rent'], scoring_profile: 'balanced', is_eligible: true },
];

export function demoSearchResponse(query: string): SearchResponse {
  return {
    intent: {
      query,
      filters: {
        office_location: 'Sector V, Salt Lake, Kolkata',
        budget_max: 20000,
        property_types: ['1BHK', '2BHK'],
        preferences: ['good internet', 'safe area', 'metro nearby'],
        transport_modes: ['metro', 'cab'],
      },
      inferred_lifestyle: ['tech_professional', 'urban_explorer'],
      follow_up_questions: [
        'Do you prefer fully furnished or semi-furnished?',
        'Is pet-friendliness a requirement?',
        'How important is a gym/pool?',
      ],
    },
    recommendations: demoRecommendations,
    properties: demoProperties,
    office_coordinates: [88.4335, 22.5762],
  };
}

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  readonly localities = demoLocalities;
  readonly properties = demoProperties;

  getLocality(id: string): Locality {
    return this.localities.find((l) => l._id === id) ?? this.localities[0];
  }

  getProperty(id: string): Property {
    return this.properties.find((p) => p._id === id) ?? this.properties[0];
  }

  searchResponse(query: string): SearchResponse {
    return demoSearchResponse(query);
  }
}
