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
  },
  {
    _id: "loc-lake-town",
    name: "Lake Town",
    slug: "lake-town",
    city: "Kolkata",
    summary: "Residential, calmer than office hubs, with good food streets and moderate commute to Sector V.",
    tags: ["peaceful", "food access", "residential", "shared flats"],
    scores: { overall: 76, women_safety: 75, late_night: 66, internet: 78, food_access: 84, commute_reliability: 70 },
    essentials: [{ name: "Lake Town Market", category: "grocery", distance_meters: 600, rating: 4.1 }],
    things_to_do: [{ name: "Lake Town Clock Tower", category: "landmark", distance_meters: 700, rating: 4.0 }]
  },
  {
    _id: "loc-kestopur",
    name: "Kestopur",
    slug: "kestopur",
    city: "Kolkata",
    summary: "Affordable rentals between New Town and Salt Lake, popular for shared flats and quick app-cab access.",
    tags: ["affordable", "shared flats", "food access", "app cab commute"],
    scores: { overall: 73, women_safety: 68, late_night: 62, internet: 80, food_access: 82, commute_reliability: 74 },
    essentials: [{ name: "Kestopur Bazaar", category: "grocery", distance_meters: 550, rating: 4.0 }],
    things_to_do: [{ name: "VIP Road food stretch", category: "food", distance_meters: 900, rating: 4.1 }]
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
    location: { type: "Point", coordinates: [88.4338, 22.5759] },
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
    location: { type: "Point", coordinates: [88.4812, 22.5799] },
    locality_id: "loc-new-town",
    nearby_metro: "Salt Lake Sector V",
    commute_estimate_minutes: 28,
    lowest_price: { source: "Housing", rent: 14000 }
  },
  {
    _id: "demo-lake-town-shared",
    title: "Shared Flat near Lake Town Clock Tower",
    source_platform: "Facebook",
    property_type: "shared flat",
    rent: 11000,
    deposit: 11000,
    area_sqft: 180,
    furnishing: "furnished",
    images: [],
    amenities: ["wifi", "kitchen", "peaceful", "food access"],
    location: { type: "Point", coordinates: [88.402, 22.6043] },
    locality_id: "loc-lake-town",
    nearby_metro: "Belgachia",
    commute_estimate_minutes: 38,
    lowest_price: { source: "Facebook", rent: 11000 }
  },
  {
    _id: "demo-kestopur-studio",
    title: "Budget Studio near Kestopur Bazaar",
    source_platform: "Local Broker",
    property_type: "studio",
    rent: 12500,
    deposit: 25000,
    area_sqft: 310,
    furnishing: "semi-furnished",
    images: [],
    amenities: ["wifi-ready", "market nearby", "app cab access"],
    location: { type: "Point", coordinates: [88.4358, 22.5996] },
    locality_id: "loc-kestopur",
    nearby_metro: "Sector V",
    commute_estimate_minutes: 22,
    lowest_price: { source: "Local Broker", rent: 12500 }
  },
  {
    _id: "demo-rajarhat-coliving",
    title: "Co-living room near Rajarhat Main Road",
    source_platform: "Telegram",
    property_type: "co-living",
    rent: 10500,
    deposit: 10500,
    area_sqft: 150,
    furnishing: "furnished",
    images: [],
    amenities: ["wifi", "housekeeping", "security", "meals optional"],
    location: { type: "Point", coordinates: [88.4687, 22.6223] },
    locality_id: "loc-new-town",
    nearby_metro: "City Centre II",
    commute_estimate_minutes: 35,
    lowest_price: { source: "Telegram", rent: 10500 }
  }
];

export function demoSearchResponse(query: string): SearchResponse {
  return {
    intent: {
      query,
      filters: {
        office_location: "Sector V, Kolkata",
        budget_max: 15000,
        property_types: ["PG", "apartment", "shared flat", "co-living"],
        preferences: ["peaceful", "internet reliability", "food access"],
        transport_modes: ["metro", "app cab"]
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
        affordability: [92, 78, 84, 81, 88][index] ?? 80,
        commute: [91, 72, 58, 76, 62][index] ?? 70,
        safety: [78, 82, 76, 73, 78][index] ?? 75,
        internet: [86, 84, 78, 80, 82][index] ?? 80,
        food_access: [92, 80, 84, 82, 78][index] ?? 80,
        lifestyle_fit: [88, 80, 85, 76, 82][index] ?? 80,
        total: [87.8, 80.6, 77.1, 78.4, 79.2][index] ?? 78,
        explanation: `${property.title} balances rent, commute, safety, internet, and daily essentials for an India-first relocation search.`
      },
      highlights: [
        `Rent around Rs ${property.rent.toLocaleString("en-IN")}`,
        property.nearby_metro ? `Near ${property.nearby_metro}` : "Good locality access",
        property.lowest_price ? `Lowest seen: Rs ${property.lowest_price.rent.toLocaleString("en-IN")}` : "Needs price verification"
      ],
      tradeoffs: index === 0 ? ["Late-night safety should be verified"] : ["Peak commute can stretch in rain"]
    }))
  };
}
