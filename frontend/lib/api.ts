import type { AuthResponse, CommuteEstimate, GuestPersonalization, GuestProfile, HardConstraints, Locality, Property, Recommendation, ScoringProfile, ScoringWeights, SearchResponse } from "@/types";
import { demoLocalities, demoProperties, demoSearchResponse } from "@/lib/demo-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface SearchOptions { profile?: ScoringProfile; weights?: Partial<ScoringWeights>; hard_constraints?: Partial<HardConstraints>; }
export type CommunityInsights = { sample_size:number; median_listed_rent:number|null; median_negotiated_rent:number|null; median_maintenance:number|null; median_brokerage:number|null; median_wifi_speed_mbps:number|null; average_savings_percent:number; negotiation_power_index:number; };

export const api = {
  search: async (query:string, options?:SearchOptions) => request<SearchResponse>("/search", { method:"POST", body:JSON.stringify({ query, profile:options?.profile, weights:options?.weights, hard_constraints:options?.hard_constraints }) }).catch(() => demoSearchResponse(query)),
  listScoringProfiles: () => request<{ profiles:ScoringProfile[]; presets:Record<ScoringProfile,ScoringWeights> }>("/recommendations/profiles"),
  rankRecommendations: (payload:{properties:Property[];profile?:ScoringProfile;weights?:Partial<ScoringWeights>;hard_constraints?:Partial<HardConstraints>;preferences?:string[];budget_max?:number|null;}) => request<{profile:string;weights:ScoringWeights;total_candidates:number;recommendations:Recommendation[]}>("/recommendations/rank", { method:"POST", body:JSON.stringify(payload) }),
  listProperties: () => request<Property[]>("/properties").catch(() => demoProperties),
  aggregateProperties: (place="Sector V Kolkata", sources=["magicbricks","99acres","nobroker","broker_crm"]) => { const params=new URLSearchParams({place}); sources.forEach((source)=>params.append("sources",source)); return request<Property[]>(`/properties/aggregate?${params.toString()}`).catch(()=>demoProperties); },
  listAggregateSources: () => request<Array<{id:string;name:string;role:string;ingestion_methods:string[];status:string;note:string}>>("/properties/aggregate/sources"),
  listOpenDataProperties: (place="Sector V Kolkata", sources=["osm","mapbox"]) => { const params=new URLSearchParams({place}); sources.forEach((source)=>params.append("sources",source)); return request<Property[]>(`/properties/open-data?${params.toString()}`).catch(()=>demoProperties); },
  listPropertySources: () => request<Array<{id:string;name:string;kind:string;note:string}>>("/properties/open-data/sources"),
  getProperty: (id:string) => request<Property>(`/properties/${id}`).catch(()=>demoProperties.find((property)=>property._id===id)??demoProperties[0]),
  listLocalities: () => request<Locality[]>("/localities").catch(()=>demoLocalities),
  getLocality: (id:string) => request<Locality>(`/localities/${id}`).catch(()=>demoLocalities.find((locality)=>locality._id===id)??demoLocalities[0]),
  commute: (payload:{origin:string;destination:string;modes?:string[]}) => request<CommuteEstimate[]>("/commute/estimate", { method:"POST", body:JSON.stringify(payload) }),
  getCommunityInsights: (localityId:string, propertyId?:string) => { const params=new URLSearchParams({locality_id:localityId}); if(propertyId) params.set("property_id",propertyId); return request<CommunityInsights>(`/feedback/insights?${params.toString()}`); },
  submitNegotiatedRent: (payload:Record<string,unknown>) => request<Record<string,unknown>>("/feedback/negotiated-rents", { method:"POST", body:JSON.stringify(payload) }),
  submitLocalityFeedback: (payload:Record<string,unknown>) => request<Record<string,unknown>>("/feedback/locality", { method:"POST", body:JSON.stringify(payload) }),
  chat: (message:string) => request<{answer:string;context:SearchResponse}>("/assistant/chat", { method:"POST", body:JSON.stringify({message}) }),

  personalizeGuest: (profile:GuestProfile) => request<GuestPersonalization>("/users/guest-profile", { method:"POST", body:JSON.stringify(profile) }),
  signup: (payload:{email?:string;password?:string;google_id_token?:string;guest_profile?:GuestProfile;guest_saved_properties?:string[]}) => request<AuthResponse>("/users/signup", { method:"POST", body:JSON.stringify(payload) }),
  login: (payload:{email?:string;password?:string;google_id_token?:string}) => request<AuthResponse>("/users/login", { method:"POST", body:JSON.stringify(payload) }),
  getMe: (token:string) => request<AuthResponse["user"]>("/users/me", { headers:bearer(token) }),
  updateMe: (token:string,payload:{profile?:Partial<GuestProfile>;weight_overrides?:Partial<ScoringWeights>}) => request<AuthResponse["user"]>("/users/me", { method:"PUT",headers:bearer(token),body:JSON.stringify(payload) }),
  saveShortlistItem: (token:string,propertyId:string) => request<{items:Array<Record<string,unknown>>;count:number}>("/users/shortlist", { method:"POST",headers:bearer(token),body:JSON.stringify({property_id:propertyId}) }),
};
