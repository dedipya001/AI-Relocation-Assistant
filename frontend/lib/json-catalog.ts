import type { Locality, Property, Recommendation, SearchResponse, ScoringWeights } from "@/types";
import bangalore from "@/data/bangalore.json";
import kolkata from "@/data/kolkata.json";
import mumbai from "@/data/mumbai.json";
import pune from "@/data/pune.json";
import { demoLocalities } from "@/lib/demo-data";

type SourceProperty = Partial<Property> & { dedupe_key?: string };
const raw: Record<string, SourceProperty[]> = {
  Kolkata: kolkata as SourceProperty[],
  Bengaluru: bangalore as SourceProperty[],
  Mumbai: mumbai as SourceProperty[],
  Pune: pune as SourceProperty[],
};
export const cityNames = Object.keys(raw);
const catalog: Property[] = Object.entries(raw).flatMap(([city, entries]) => entries.map((entry, index) => ({
  ...entry,
  _id: entry._id || `${city.toLowerCase()}-${index}`,
  title: entry.title || `Rental property in ${city}`,
  source_platform: entry.source_platform || "Dataset",
  property_type: entry.property_type || "rental",
  rent: Number(entry.rent) || 0,
  images: entry.images || [],
  amenities: entry.amenities || [],
  locality_id: entry.locality_id || entry.locality || city.toLowerCase(),
  city,
})) as Property[]).filter((item) => item.rent > 0);

const baseWeights: ScoringWeights = {affordability:.22,commute:.22,safety:.20,internet:.14,food_access:.10,lifestyle_fit:.07,property_quality:.05};
export function selectCity(query: string): string {
  if (/mumbai/i.test(query)) return "Mumbai";
  if (/pune|hinjewadi/i.test(query)) return "Pune";
  if (/bengaluru|bangalore/i.test(query)) return "Bengaluru";
  return "Kolkata";
}
export function allProperties() { return catalog; }
export function findProperty(id: string) { return catalog.find(p => p._id === id); }
export function allLocalities(): Locality[] {
  const result = [...demoLocalities];
  const found = new Set(result.map(l => `${l.city}:${l.slug}`));
  for (const p of catalog) {
    const name = p.locality || p.locality_id || p.city || "Unknown";
    const city = p.city || "Kolkata";
    const slug = p.locality_id || name;
    const key = `${city}:${slug}`;
    if (found.has(key)) continue;
    found.add(key);
    result.push({
      _id: `${city.toLowerCase()}:${slug}`, name, slug, city,
      summary: `Rental listings in ${name}, ${city}. Locality quality scores have not been verified.`,
      tags: ["rental dataset"],
      scores: {overall:0,women_safety:0,late_night:0,internet:0,food_access:0,commute_reliability:0},
      essentials:[], things_to_do:[]
    });
  }
  return result;
}
export function searchCatalog(query:string,budget?:number, weights?:Partial<ScoringWeights>):SearchResponse {
  const city = selectCity(query);
  const match = query.match(/(?:budget|under|below|upto|up to|max(?:imum)?)[^0-9]{0,18}(\d[\d,.]*)(\s*k)?/i);
  const parsed = match ? Number(match[1].replace(/,/g,""))*(match[2]?1000:1):undefined;
  const ceiling = budget || parsed;
  const cityItems = catalog.filter(p=>p.city===city);
  const eligible = cityItems.filter(p=>!ceiling || p.rent<=ceiling);
  const candidates = (eligible.length?eligible:cityItems).slice().sort((a,b)=>a.rent-b.rent).slice(0,60);
  const effective= {...baseWeights,...weights};
  const recommendations:Recommendation[]=candidates.map((p,i)=>{
    const affordability=Math.max(0,Math.min(100,Math.round(100*(1-p.rent/(ceiling || 50000)))));
    const commute = p.commute_estimate_minutes != null ? Math.max(0,100-Math.round(p.commute_estimate_minutes*2)):0;
    const total=Math.round((affordability*effective.affordability+commute*effective.commute)*100)/100;
    return {rank:i+1,entity_type:"property",entity_id:p._id,title:p.title,
      locality_name:p.locality || p.locality_id,source_platform:p.source_platform,source_url:p.source_url,
      score:{affordability,commute,safety:0,internet:0,food_access:0,lifestyle_fit:0,property_quality:0,total,
        explanation:"Dataset-based ranking. Unverified neighborhood signals are excluded from scoring."},
      highlights:[`Listed rent ₹${p.rent.toLocaleString("en-IN")}`,p.locality || city],
      tradeoffs:["Listing and locality details should be independently verified."],is_eligible:!ceiling||p.rent<=ceiling,
      scoring_profile:"balanced"};
  });
  return {intent:{query,filters:{city,budget_max:ceiling,property_types:[],preferences:[],transport_modes:[]},inferred_lifestyle:[],follow_up_questions:[]},properties:candidates,recommendations};
}
