import type { Db } from "mongodb";
import { getOpenAIClient } from "../ai/client.js";
import { config } from "../core/config.js";
import { cityPartition } from "../data/multiCity.js";
import { CommuteService } from "./commute.js";

export type ComparisonMetric = {
  locality_id: string;
  locality_name: string;
  city: string;
  rent: {
    sample_size: number;
    minimum: number | null;
    median: number | null;
    median_1bhk: number | null;
    median_2bhk: number | null;
    median_3bhk: number | null;
  };
  commute: {
    workplace: string;
    road_distance_km: number | null;
    road_distance_method: string;
    peak_morning_minutes: number | null;
    off_peak_minutes: number | null;
    estimate_method: string;
    nearest_metro: string | null;
  };
  scores: {
    affordability: number;
    commute: number;
    safety: number;
    lifestyle: number;
    infrastructure: number;
    overall: number;
  };
  infrastructure: {
    power_reliability_proxy: number;
    water_supply_proxy: number;
    isp_infrastructure_proxy: number;
    methodology: string[];
  };
  source_quality: {
    property_samples: number;
    direct_rent_data: boolean;
    infrastructure_is_proxy: true;
  };
};

export type LocalityComparisonResult = {
  workplace: string;
  workplace_coordinates: [number, number] | null;
  compared_at: string;
  localities: ComparisonMetric[];
  category_winners: Record<string, { locality_id: string; locality_name: string; score: number }>;
  executive_tradeoff_analysis: string;
  synthesis_mode: "deterministic" | "ai";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : Number(((clean[mid - 1] + clean[mid]) / 2).toFixed(0));
}

function extractBhk(property: Record<string, any>): number | null {
  const explicit = Number(property.bhk);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 5) return explicit;
  const haystack = [
    property.title,
    property.property_type,
    ...(Array.isArray(property.amenities) ? property.amenities : []),
  ]
    .filter(Boolean)
    .join(" ");
  const match = haystack.match(/\b([1-5])\s*[- ]?bhk\b/i);
  return match ? Number(match[1]) : null;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function coverage(properties: Record<string, any>[], terms: string[]) {
  if (!properties.length) return 0;
  const matched = properties.filter((property) => {
    const text = (Array.isArray(property.amenities) ? property.amenities : [])
      .join(" ")
      .toLowerCase();
    return terms.some((term) => text.includes(term));
  }).length;
  return matched / properties.length;
}

function localityCoords(locality: Record<string, any>): [number, number] | null {
  const coords = locality.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function exactRegex(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

export class LocalityComparisonService {
  constructor(private readonly db: Db) {}

  async compare(
    localityRefs: string[],
    workplace: string,
    workplaceCoordinates: [number, number] | null
  ): Promise<LocalityComparisonResult> {
    const refs = [...new Set(localityRefs.map((value) => value.trim()).filter(Boolean))];
    if (refs.length < 2 || refs.length > 4) {
      throw new Error("Compare between 2 and 4 unique localities.");
    }

    const localities = await this.resolveLocalities(refs);
    if (localities.length !== refs.length) {
      const found = new Set(localities.flatMap((item) => [String(item._id), String(item.slug), String(item.name)]));
      const missing = refs.filter((ref) => !found.has(ref));
      throw new Error(`Localities not found: ${missing.join(", ")}`);
    }

    const raw: Array<{ locality: Record<string, any>; properties: Record<string, any>[]; metric: Omit<ComparisonMetric, "scores"> }> = [];
    for (const locality of localities) {
      const properties = await this.propertiesForLocality(locality);
      raw.push({ locality, properties, metric: await this.buildRawMetric(locality, properties, workplace, workplaceCoordinates) });
    }

    const rentMedians = raw.map((item) => item.metric.rent.median).filter((value): value is number => value !== null);
    const peakCommutes = raw.map((item) => item.metric.commute.peak_morning_minutes).filter((value): value is number => value !== null);
    const bestRent = rentMedians.length ? Math.min(...rentMedians) : null;
    const bestCommute = peakCommutes.length ? Math.min(...peakCommutes) : null;

    const metrics: ComparisonMetric[] = raw.map(({ locality, metric }) => {
      const localityScores = locality.scores || {};
      const affordability = metric.rent.median && bestRent ? clamp((bestRent / metric.rent.median) * 100) : 50;
      const commute = metric.commute.peak_morning_minutes && bestCommute
        ? clamp((bestCommute / metric.commute.peak_morning_minutes) * 100)
        : 50;
      const safety = clamp(Number(localityScores.women_safety ?? localityScores.overall ?? 60));
      const lifestyle = clamp(
        (Number(localityScores.food_access ?? 60) +
          Number(localityScores.late_night ?? 60) +
          Number(localityScores.overall ?? 60)) /
          3
      );
      const infrastructure = clamp(
        (metric.infrastructure.power_reliability_proxy +
          metric.infrastructure.water_supply_proxy +
          metric.infrastructure.isp_infrastructure_proxy) /
          3
      );
      const overall = clamp(
        affordability * 0.25 + commute * 0.25 + safety * 0.2 + lifestyle * 0.15 + infrastructure * 0.15
      );

      return {
        ...metric,
        scores: {
          affordability: Number(affordability.toFixed(1)),
          commute: Number(commute.toFixed(1)),
          safety: Number(safety.toFixed(1)),
          lifestyle: Number(lifestyle.toFixed(1)),
          infrastructure: Number(infrastructure.toFixed(1)),
          overall: Number(overall.toFixed(1)),
        },
      };
    });

    const categoryWinners = this.categoryWinners(metrics);
    const deterministic = this.deterministicSynthesis(metrics, categoryWinners, workplace);
    const aiSynthesis = await this.aiSynthesis(metrics, categoryWinners, workplace, deterministic);

    return {
      workplace,
      workplace_coordinates: workplaceCoordinates,
      compared_at: new Date().toISOString(),
      localities: metrics,
      category_winners: categoryWinners,
      executive_tradeoff_analysis: aiSynthesis ?? deterministic,
      synthesis_mode: aiSynthesis ? "ai" : "deterministic",
    };
  }

  private async resolveLocalities(refs: string[]) {
    const docs = await this.db
      .collection("localities")
      .find({
        $or: [
          { _id: { $in: refs } as any },
          { slug: { $in: refs } },
          { name: { $in: refs.map((ref) => exactRegex(ref)) } as any },
        ],
      } as any)
      .toArray();

    return refs
      .map((ref) => docs.find((doc) => String(doc._id) === ref || doc.slug === ref || String(doc.name).toLowerCase() === ref.toLowerCase()))
      .filter(Boolean) as Record<string, any>[];
  }

  private async propertiesForLocality(locality: Record<string, any>) {
    const names = (await this.db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
    const candidates = ["properties", cityPartition(String(locality.city || ""))].filter(
      (name, index, all) => all.indexOf(name) === index && names.includes(name)
    );
    const docs: Record<string, any>[] = [];
    for (const name of candidates) {
      const rows = await this.db
        .collection(name)
        .find({
          $or: [
            { locality_id: String(locality._id) },
            { locality: exactRegex(String(locality.name)) },
          ],
        } as any)
        .toArray();
      docs.push(...rows);
    }

    const deduped = new Map<string, Record<string, any>>();
    for (const property of docs) {
      const key = String(
        property.dedupe_key ||
          property.source_url ||
          `${property.title || "property"}|${property.rent || 0}|${property.locality_id || locality._id}`
      );
      if (!deduped.has(key)) deduped.set(key, property);
    }
    return [...deduped.values()];
  }

  private async buildRawMetric(
    locality: Record<string, any>,
    properties: Record<string, any>[],
    workplace: string,
    workplaceCoordinates: [number, number] | null
  ): Promise<Omit<ComparisonMetric, "scores">> {
    const rents = properties.map((item) => Number(item.rent)).filter((value) => Number.isFinite(value) && value > 0);
    const rentsByBhk = (bhk: number) =>
      properties
        .filter((item) => extractBhk(item) === bhk)
        .map((item) => Number(item.rent))
        .filter((value) => Number.isFinite(value) && value > 0);

    const origin = localityCoords(locality);
    const straightLine = origin && workplaceCoordinates ? haversineKm(origin, workplaceCoordinates) : null;
    const roadDistance = straightLine === null ? null : Number((straightLine * 1.18).toFixed(1));
    const commuteService = await new CommuteService().estimate(String(locality.name), workplace, ["metro", "bus", "uber"]);
    const servicePeakDelay = median(commuteService.map((item) => Number(item.peak_delay_minutes)).filter(Number.isFinite)) ?? 12;
    const storedCommute = median(
      properties
        .map((item) => Number(item.commute_estimate_minutes))
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    const distanceDerived = roadDistance === null ? null : Math.max(8, Math.round(roadDistance * 2.7 + 6));
    const baseCommute = storedCommute ?? distanceDerived ?? median(commuteService.map((item) => Number(item.minutes)).filter(Number.isFinite));
    const peak = baseCommute === null ? null : Math.round(baseCommute + servicePeakDelay);
    const offPeak = baseCommute === null ? null : Math.max(5, Math.round(baseCommute - servicePeakDelay * 0.35));

    const transit = [
      ...(Array.isArray(locality.transit) ? locality.transit : []),
      ...(Array.isArray(locality.city_transit) ? locality.city_transit.map((item: any) => item.name || item.corridor) : []),
      ...properties.map((item) => item.nearby_metro).filter(Boolean),
    ].filter(Boolean);
    const nearestMetro = transit.find((item: any) => /metro|line/i.test(String(item))) ?? transit[0] ?? null;

    const scores = locality.scores || {};
    const powerCoverage = coverage(properties, ["power backup", "generator", "inverter"]);
    const waterCoverage = coverage(properties, ["water", "borewell", "municipal"]);
    const internetCoverage = coverage(properties, ["internet", "wifi", "fiber", "broadband"]);
    const powerProxy = clamp(Number(scores.commute_reliability ?? scores.overall ?? 60) * 0.65 + powerCoverage * 35);
    const waterProxy = clamp(Number(scores.overall ?? 60) * 0.6 + waterCoverage * 40);
    const ispProxy = clamp(Number(scores.internet ?? 60) * 0.75 + internetCoverage * 25);

    return {
      locality_id: String(locality._id),
      locality_name: String(locality.name),
      city: String(locality.city || ""),
      rent: {
        sample_size: rents.length,
        minimum: rents.length ? Math.min(...rents) : null,
        median: median(rents),
        median_1bhk: median(rentsByBhk(1)),
        median_2bhk: median(rentsByBhk(2)),
        median_3bhk: median(rentsByBhk(3)),
      },
      commute: {
        workplace,
        road_distance_km: roadDistance,
        road_distance_method: roadDistance === null ? "unavailable" : "haversine_x_1.18_road_proxy",
        peak_morning_minutes: peak,
        off_peak_minutes: offPeak,
        estimate_method: storedCommute !== null ? "property_median_plus_commute_service_peak_delay" : "distance_proxy_plus_commute_service_peak_delay",
        nearest_metro: nearestMetro ? String(nearestMetro) : null,
      },
      infrastructure: {
        power_reliability_proxy: Number(powerProxy.toFixed(1)),
        water_supply_proxy: Number(waterProxy.toFixed(1)),
        isp_infrastructure_proxy: Number(ispProxy.toFixed(1)),
        methodology: [
          "Power reliability is a proxy using locality reliability scores plus power-backup amenity prevalence.",
          "Water supply is a proxy using locality overall score plus water-related amenity prevalence; it is not a utility-quality measurement.",
          "ISP infrastructure is a proxy combining the locality internet score with internet/fiber/Wi-Fi amenity prevalence.",
        ],
      },
      source_quality: {
        property_samples: rents.length,
        direct_rent_data: rents.length > 0,
        infrastructure_is_proxy: true,
      },
    };
  }

  private categoryWinners(metrics: ComparisonMetric[]) {
    const categories = ["affordability", "commute", "safety", "lifestyle", "infrastructure", "overall"] as const;
    const winners: Record<string, { locality_id: string; locality_name: string; score: number }> = {};
    for (const category of categories) {
      const winner = [...metrics].sort((a, b) => b.scores[category] - a.scores[category])[0];
      winners[category] = {
        locality_id: winner.locality_id,
        locality_name: winner.locality_name,
        score: winner.scores[category],
      };
    }
    return winners;
  }

  private deterministicSynthesis(
    metrics: ComparisonMetric[],
    winners: Record<string, { locality_id: string; locality_name: string; score: number }>,
    workplace: string
  ) {
    const overall = winners.overall;
    const affordable = winners.affordability;
    const commute = winners.commute;
    const safest = winners.safety;
    const infrastructure = winners.infrastructure;
    const overallMetric = metrics.find((item) => item.locality_id === overall.locality_id)!;
    const rentText = overallMetric.rent.median === null ? "limited rent samples" : `a median observed rent of Rs ${overallMetric.rent.median.toLocaleString("en-IN")}`;
    const commuteText = overallMetric.commute.peak_morning_minutes === null ? "an unresolved commute" : `an estimated ${overallMetric.commute.peak_morning_minutes}-minute peak commute`;
    return `${overall.locality_name} is the strongest overall trade-off for ${workplace}, with ${rentText} and ${commuteText}. ${affordable.locality_name} leads affordability, ${commute.locality_name} leads commute, ${safest.locality_name} leads safety, and ${infrastructure.locality_name} leads the infrastructure proxy. Infrastructure scores are proxy indicators, not direct utility-quality measurements.`;
  }

  private async aiSynthesis(
    metrics: ComparisonMetric[],
    winners: Record<string, { locality_id: string; locality_name: string; score: number }>,
    workplace: string,
    fallback: string
  ): Promise<string | null> {
    const client = getOpenAIClient();
    if (!client) return null;
    try {
      const response = await client.chat.completions.create({
        model: config.OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content: "Write a concise relocation executive trade-off analysis using only the supplied JSON. Do not invent facts. Explicitly call infrastructure fields proxies, not measured utility quality.",
          },
          {
            role: "user",
            content: JSON.stringify({ workplace, metrics, category_winners: winners, deterministic_fallback: fallback }),
          },
        ],
      });
      return response.choices[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }
}
