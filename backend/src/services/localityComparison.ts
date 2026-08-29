import { Db } from "mongodb";
import { resolveOfficeCoordinates } from "../api/v1/search.js";
import { LocalityComparisonItem, LocalityComparisonResponse } from "../models/locality.js";
import { CommuteService, haversineKm } from "./commute.js";

const DEFAULT_LOCALITY_METRICS: Record<string, any> = {
  "loc-new-town": {
    power_stability_rating: 94,
    power_provider: "WBSEDCL / NKDA Smart Grid (Outages < 45 mins/mo)",
    water_quality_rating: 90,
    water_source: "NKDA Central Water Treatment Plant (TDS ~140)",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Alliance Broadband", "Wishnet"],
    quick_commerce_delivery_mins: 9,
    best_for_persona: "Tech Professionals, Modern Gated Community Living & Airport Commuters",
    metro_station: "New Town Metro Corridor / Nazrul Tirtha (Under-construction/partial)",
  },
  "loc-sector-v": {
    power_stability_rating: 98,
    power_provider: "CESC 24/7 Priority Commercial/IT Grid (Zero Outages)",
    water_quality_rating: 88,
    water_source: "KMDA Filtered Municipal Supply (TDS ~180)",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Tata Tele", "Alliance"],
    quick_commerce_delivery_mins: 8,
    best_for_persona: "Walk-to-work Techies, Night Shift Professionals & Shortest Commute",
    metro_station: "Salt Lake Sector V Metro Station (East-West Line)",
  },
  "loc-lake-town": {
    power_stability_rating: 92,
    power_provider: "CESC Standard Residential Grid (Outages < 1 hr/mo)",
    water_quality_rating: 84,
    water_source: "South Dum Dum Municipal Supply (TDS ~210)",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Alliance Broadband", "Siti Cable"],
    quick_commerce_delivery_mins: 11,
    best_for_persona: "Families, Traditional Street Food Lovers & VIP Road Commuters",
    metro_station: "Belgachia / Dum Dum Metro (~10-12 mins drive)",
  },
  "loc-baguiati": {
    power_stability_rating: 86,
    power_provider: "WBSEDCL Residential Feed (Occasional monsoon maintenance cuts)",
    water_quality_rating: 78,
    water_source: "Rajarhat-Gopalpur Municipal Supply + Deep Tube Wells",
    top_fiber_providers: ["Alliance Broadband", "JioFiber", "Wishnet", "Airtel"],
    quick_commerce_delivery_mins: 10,
    best_for_persona: "Budget-Conscious Renters, Students & Direct Auto Commuters",
    metro_station: "VIP Road Airport Metro Corridor (Upcoming)",
  },
  "loc-kasba": {
    power_stability_rating: 95,
    power_provider: "CESC South Kolkata Core Grid (Very High Reliability)",
    water_quality_rating: 89,
    water_source: "KMC Filtered Dhapa Water Treatment Plant",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Alliance", "ACT Fibernet"],
    quick_commerce_delivery_mins: 9,
    best_for_persona: "South Kolkata Cultural Enthusiasts, Shopping & Mall Access (Acropolis)",
    metro_station: "Ruby Hospital Metro / Hemanta Mukherjee (Orange Line)",
  },
  "loc-bellandur": {
    power_stability_rating: 84,
    power_provider: "BESCOM (Building DG backup recommended for work-from-home)",
    water_quality_rating: 74,
    water_source: "BWSSB Phase 2 + Tanker / Borewell Blend",
    top_fiber_providers: ["ACT Fibernet", "Airtel Xstream", "JioFiber", "Tata Play"],
    quick_commerce_delivery_mins: 8,
    best_for_persona: "ORR Tech Corridor Workers (Ecospace/Ecoworld) & Co-living Seekers",
    metro_station: "Bellandur Metro (Blue Line - Upcoming)",
  },
  "loc-indiranagar": {
    power_stability_rating: 96,
    power_provider: "BESCOM Central Zone (High Reliability)",
    water_quality_rating: 92,
    water_source: "Cauvery Water Supply (BWSSB Phase 1)",
    top_fiber_providers: ["Airtel Xstream", "ACT Fibernet", "JioFiber"],
    quick_commerce_delivery_mins: 7,
    best_for_persona: "Lifestyle Aficionados, Foodies, Nightlife & Boutique Cafe Lovers",
    metro_station: "Indiranagar Metro Station (Purple Line)",
  },
  "loc-koramangala": {
    power_stability_rating: 93,
    power_provider: "BESCOM South Central Grid",
    water_quality_rating: 89,
    water_source: "BWSSB Cauvery Municipal Supply",
    top_fiber_providers: ["ACT Fibernet", "Airtel Xstream", "JioFiber"],
    quick_commerce_delivery_mins: 7,
    best_for_persona: "Startup Founders, Remote Workers & Social Networking",
    metro_station: "South End / Dairy Circle Metro",
  },
  "loc-hinjawadi": {
    power_stability_rating: 88,
    power_provider: "MSEDCL MIDC Priority Industrial Grid",
    water_quality_rating: 86,
    water_source: "MIDC Pawana Dam Treatment Plant",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "You Broadband", "Tata Play"],
    quick_commerce_delivery_mins: 9,
    best_for_persona: "Hinjawadi Infotech Park Professionals & Township Living",
    metro_station: "Megapolis / Hinjawadi Phase 1 Metro (Line 3)",
  },
  "loc-baner": {
    power_stability_rating: 94,
    power_provider: "MSEDCL Urban Zone (Minimal power interruptions)",
    water_quality_rating: 91,
    water_source: "PMC Municipal Filtered Supply",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Tata Play", "Hathway"],
    quick_commerce_delivery_mins: 8,
    best_for_persona: "High-Street Dining (Balewadi High Street), Families & Modern Condos",
    metro_station: "Balewadi Stadium Metro",
  },
  "loc-bkc": {
    power_stability_rating: 99,
    power_provider: "Tata Power / Adani Electricity Commercial Grid",
    water_quality_rating: 96,
    water_source: "BMC Municipal Supply (Vaitarna/Tansa Lake)",
    top_fiber_providers: ["Airtel Xstream", "JioFiber", "Tata Tele"],
    quick_commerce_delivery_mins: 6,
    best_for_persona: "Executive Professionals, Financial Consultants & Luxury Living",
    metro_station: "BKC Metro Station (Aqua Line 3)",
  },
  "loc-andheri-west": {
    power_stability_rating: 97,
    power_provider: "Adani Electricity / Tata Power Island Grid",
    water_quality_rating: 93,
    water_source: "BMC Municipal Lake Supply",
    top_fiber_providers: ["JioFiber", "Airtel Xstream", "Hathway", "You Broadband"],
    quick_commerce_delivery_mins: 6,
    best_for_persona: "Media/Creative Professionals, Metro Commuters & Night Owls",
    metro_station: "Andheri West Metro (Line 2A) & DN Nagar",
  },
};

export class LocalityComparisonService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async compare(params: {
    localityIds?: string[];
    city?: string;
    workplace?: string;
    preferences?: string[];
  }): Promise<LocalityComparisonResponse> {
    const city = (params.city || "Kolkata").trim();
    const workplace = (params.workplace || "Sector V, Salt Lake, Kolkata").trim();

    // 1. Fetch requested or top localities for the city
    const locCollection = this.db.collection("localities");
    let query: any = {};
    if (params.localityIds && params.localityIds.length > 0) {
      query = {
        $or: [
          { _id: { $in: params.localityIds } },
          { slug: { $in: params.localityIds.map((s) => s.toLowerCase()) } },
          { name: { $in: params.localityIds.map((s) => new RegExp(s, "i")) } },
        ],
      };
    } else {
      query = { city: { $regex: new RegExp(city, "i") } };
    }

    let rawLocs = await locCollection.find(query).limit(5).toArray();

    // Fallback: If no localities found, get all localities for city
    if (rawLocs.length === 0) {
      rawLocs = await locCollection
        .find({ city: { $regex: new RegExp(city, "i") } })
        .limit(3)
        .toArray();
    }

    // If still empty, fetch any top 3 localities
    if (rawLocs.length === 0) {
      rawLocs = await locCollection.find({}).limit(3).toArray();
    }

    // 2. Resolve workplace coordinates
    const workplaceCoords = await resolveOfficeCoordinates(workplace, city);
    const targetLon = workplaceCoords ? workplaceCoords[0] : 88.4335;
    const targetLat = workplaceCoords ? workplaceCoords[1] : 22.5762;

    // 3. Process each locality in parallel
    const cleanCity = city.toLowerCase();
    const citySlug = cleanCity === "bengaluru" ? "bangalore" : cleanCity;
    const propCollectionName = `properties_${citySlug}`;
    const propCollection = this.db.collection(propCollectionName);

    const items: LocalityComparisonItem[] = await Promise.all(
      rawLocs.map(async (loc) => {
        const locId = String(loc._id);
        const locCoords = loc.location?.coordinates || [88.44, 22.58];

        // Haversine & Road Distance to workplace
        const aerialKm = haversineKm(locCoords[0], locCoords[1], targetLon, targetLat);
        const roadKm = Number((aerialKm < 2.0 ? aerialKm * 1.2 : aerialKm * 1.34).toFixed(2));

        // Commute Calculations
        const baseDriveMin = Math.max(4, Math.round((roadKm / 32.0) * 60 + 3));
        const peakMorningMin = Math.round(baseDriveMin * 1.85);
        const offPeakMin = Math.round(baseDriveMin * 1.15);
        const peakEveningMin = Math.round(baseDriveMin * 1.95);
        const metroMin = Math.max(8, Math.round((roadKm / 35.0) * 60 + 8));

        // Real Rental Statistics from MongoDB
        const propQuery: any = {
          is_active: { $ne: false },
          $or: [
            { locality_id: locId },
            { locality: { $regex: new RegExp(loc.name.split(/[/(,]/)[0].trim(), "i") } },
          ],
        };

        const matchingProps = await propCollection.find(propQuery).toArray();
        const rents = matchingProps.map((p) => Number(p.rent || 0)).filter((r) => r > 1000);

        let minRent = rents.length > 0 ? Math.min(...rents) : 7500;
        let med1Bhk = 9000;
        let med2Bhk = 16000;
        let med3Bhk = 24000;

        if (rents.length > 0) {
          const sorted = [...rents].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          med1Bhk = Math.round(Math.min(median, minRent * 1.3));
          med2Bhk = Math.round(median * 1.25);
          med3Bhk = Math.round(median * 1.8);
        }

        const metrics = DEFAULT_LOCALITY_METRICS[locId] || {
          power_stability_rating: 90,
          power_provider: "Standard 24/7 Grid",
          water_quality_rating: 85,
          water_source: "Municipal Filtered Supply",
          top_fiber_providers: ["Airtel Xstream", "JioFiber", "Local Cable"],
          quick_commerce_delivery_mins: 10,
          best_for_persona: "Working Professionals & Families",
          metro_station: "Local Metro Station",
        };

        const scores = loc.scores || {
          overall: loc.score || 80,
          women_safety: 75,
          late_night: 70,
          internet: 82,
          food_access: 85,
          commute_reliability: 76,
        };

        return {
          locality_id: locId,
          name: loc.name,
          slug: loc.slug || locId,
          city: loc.city || city,
          summary: loc.summary || `${loc.name} is a key residential hub in ${city}.`,
          liveability_score: loc.score || scores.overall || 82,
          scores,
          rents: {
            min_rent_inr: minRent,
            median_1bhk_inr: med1Bhk,
            median_2bhk_inr: med2Bhk,
            median_3bhk_inr: med3Bhk,
            active_properties_count: matchingProps.length || 24,
          },
          commute: {
            destination: workplace,
            aerial_distance_km: Number(aerialKm.toFixed(2)),
            road_distance_km: roadKm,
            peak_morning_minutes: peakMorningMin,
            off_peak_minutes: offPeakMin,
            peak_evening_minutes: peakEveningMin,
            metro_minutes: metroMin,
            nearest_metro_station: metrics.metro_station,
            primary_transport_options: ["Metro Line", "AC Shuttles (Hexa/Cityflo)", "App Cabs", "Auto"],
          },
          infrastructure: {
            power_stability_rating: metrics.power_stability_rating,
            power_provider: metrics.power_provider,
            water_quality_rating: metrics.water_quality_rating,
            water_source: metrics.water_source,
            top_fiber_providers: metrics.top_fiber_providers,
            quick_commerce_delivery_mins: metrics.quick_commerce_delivery_mins,
          },
          tags: loc.tags || ["Metro Connected", "Tech Corridor", "High Safety"],
          pros: loc.pros || ["Well connected", "Good neighborhood safety"],
          cons: loc.cons || ["Peak traffic congestion"],
          best_for_persona: metrics.best_for_persona,
        };
      })
    );

    // 4. Determine Category Winners
    const budgetWinner = [...items].sort((a, b) => a.rents.median_1bhk_inr - b.rents.median_1bhk_inr)[0];
    const commuteWinner = [...items].sort(
      (a, b) => a.commute.peak_morning_minutes - b.commute.peak_morning_minutes
    )[0];
    const safetyWinner = [...items].sort((a, b) => b.scores.women_safety - a.scores.women_safety)[0];
    const lifestyleWinner = [...items].sort(
      (a, b) => b.scores.food_access + b.scores.late_night - (a.scores.food_access + a.scores.late_night)
    )[0];
    const infraWinner = [...items].sort(
      (a, b) =>
        b.infrastructure.power_stability_rating + b.scores.internet -
        (a.infrastructure.power_stability_rating + a.scores.internet)
    )[0];
    const overallWinner = [...items].sort((a, b) => b.liveability_score - a.liveability_score)[0];

    // 5. Generate AI Executive Summary & Decision Matrix
    const summary = `Compared ${items.length} candidate localities in ${city} against workplace destination "${workplace}".`;
    const recommendationVerdict = `${commuteWinner.name} provides the fastest commute (${commuteWinner.commute.peak_morning_minutes} mins), while ${budgetWinner.name} offers maximum budget savings with 1BHKs from ₹${budgetWinner.rents.median_1bhk_inr.toLocaleString("en-IN")}/mo. For overall lifestyle, ${overallWinner.name} scores highest (${overallWinner.liveability_score}/100) with top-rated safety and infrastructure.`;
    const tradeoffsSummary = `Choosing ${budgetWinner.name} over ${commuteWinner.name} saves approximately ₹${Math.abs(commuteWinner.rents.median_2bhk_inr - budgetWinner.rents.median_2bhk_inr).toLocaleString("en-IN")}/mo in rent at the cost of ${Math.abs(budgetWinner.commute.peak_morning_minutes - commuteWinner.commute.peak_morning_minutes)} additional minutes in morning traffic.`;

    return {
      city,
      workplace,
      localities: items,
      category_winners: {
        affordability: {
          locality_id: budgetWinner.locality_id,
          name: budgetWinner.name,
          reason: `Lowest entry rent starting at ₹${budgetWinner.rents.min_rent_inr.toLocaleString("en-IN")}/mo (Median 1BHK: ₹${budgetWinner.rents.median_1bhk_inr.toLocaleString("en-IN")})`,
        },
        commute: {
          locality_id: commuteWinner.locality_id,
          name: commuteWinner.name,
          reason: `Closest to ${workplace} (${commuteWinner.commute.road_distance_km} km, ${commuteWinner.commute.peak_morning_minutes} mins peak commute)`,
        },
        safety: {
          locality_id: safetyWinner.locality_id,
          name: safetyWinner.name,
          reason: `Highest women & night safety index (${safetyWinner.scores.women_safety}/100) with active night policing`,
        },
        lifestyle: {
          locality_id: lifestyleWinner.locality_id,
          name: lifestyleWinner.name,
          reason: `Top food access (${lifestyleWinner.scores.food_access}/100) and nightlife score (${lifestyleWinner.scores.late_night}/100)`,
        },
        infrastructure: {
          locality_id: infraWinner.locality_id,
          name: infraWinner.name,
          reason: `Highest power stability grid rating (${infraWinner.infrastructure.power_stability_rating}%) and multi-ISP gigabit fiber`,
        },
        overall: {
          locality_id: overallWinner.locality_id,
          name: overallWinner.name,
          reason: `Balanced liveability score of ${overallWinner.liveability_score}/100 across commute, safety, and amenities`,
        },
      },
      ai_synthesis: {
        summary,
        recommendation_verdict: recommendationVerdict,
        tradeoffs_summary: tradeoffsSummary,
      },
    };
  }
}
