import type { Locality, Property, SearchResponse } from "@/types";

export const demoLocalities: Locality[] = [
  {
    _id: "loc-sector-v",
    name: "Sector V",
    slug: "sector-v",
    city: "Kolkata",
    summary: "Dense office district with short commutes, strong food access, and higher weekday traffic.",
    tags: ["tech workers", "metro connectivity", "food access", "fast internet"],
    scores: { overall: 78, women_safety: 72, late_night: 68, internet: 86, food_access: 92, commute_reliability: 80 },
    essentials: [{ name: "Karunamoyee Market", category: "grocery", distance_meters: 950, rating: 4.2 }],
    things_to_do: [{ name: "Nicco Park", category: "attraction", distance_meters: 1600, rating: 4.3 }]
  },
  {
    _id: "loc-new-town",
    name: "New Town",
    slug: "new-town",
    city: "Kolkata",
    summary: "Planned locality with newer housing, cafes, parks, and better value, but rain and traffic can affect commutes.",
    tags: ["planned locality", "parks", "affordable rentals", "cafes"],
    scores: { overall: 82, women_safety: 78, late_night: 74, internet: 84, food_access: 80, commute_reliability: 72 },
    essentials: [{ name: "Axis Mall", category: "mall", distance_meters: 1200, rating: 4.4 }],
    things_to_do: [{ name: "Eco Park", category: "park", distance_meters: 3100, rating: 4.5 }]
  }
];

export const demoProperties: Property[] = [
  {
    _id: "demo-sector-v-pg",
    title: "Furnished PG near Wipro More",
    source_platform: "Housing",
    property_type: "PG",
    rent: 9500,
    deposit: 9500,
    area_sqft: 120,
    furnishing: "furnished",
    images: [],
    amenities: ["wifi", "meals", "laundry", "metro connectivity"],
    locality_id: "loc-sector-v",
    nearby_metro: "Sector V",
    commute_estimate_minutes: 8,
    lowest_price: { source: "Housing", rent: 9500 }
  },
  {
    _id: "demo-new-town-1bhk",
    title: "1BHK in New Town Action Area I",
    source_platform: "MagicBricks",
    property_type: "apartment",
    rent: 14500,
    deposit: 29000,
    area_sqft: 520,
    furnishing: "semi-furnished",
    images: [],
    amenities: ["lift", "security", "power backup", "fast internet"],
    locality_id: "loc-new-town",
    nearby_metro: "Salt Lake Sector V",
    commute_estimate_minutes: 28,
    lowest_price: { source: "Housing", rent: 14000 }
  }
];

export function demoSearchResponse(query: string): SearchResponse {
  return {
    intent: {
      query,
      filters: {
        office_location: "Sector V, Kolkata",
        budget_max: 15000,
        property_types: ["PG", "apartment"],
        preferences: ["peaceful", "internet reliability", "food access"],
        transport_modes: ["metro"]
      },
      inferred_lifestyle: ["internet reliability", "food access", "low commute"],
      follow_up_questions: []
    },
    properties: demoProperties,
    recommendations: demoProperties.map((property, index) => ({
      entity_type: "property",
      entity_id: property._id,
      title: property.title,
      locality_name: demoLocalities.find((locality) => locality._id === property.locality_id)?.name,
      score: {
        affordability: index === 0 ? 92 : 78,
        commute: index === 0 ? 91 : 72,
        safety: index === 0 ? 78 : 82,
        internet: 86,
        food_access: index === 0 ? 92 : 80,
        lifestyle_fit: 84,
        total: index === 0 ? 87.8 : 80.6,
        explanation: `${property.title} is a strong demo match across rent, commute, safety, and daily essentials.`
      },
      highlights: [
        `Rent around Rs ${property.rent.toLocaleString("en-IN")}`,
        property.nearby_metro ? `Near ${property.nearby_metro} metro` : "Good locality access",
        "Demo data shown until backend is online"
      ],
      tradeoffs: index === 0 ? ["Late-night safety should be verified"] : ["Peak commute can stretch in rain"]
    }))
  };
}
