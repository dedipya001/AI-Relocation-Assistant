import type { SearchResponse, Locality, Property, CommuteEstimate } from "@/types";
import { demoLocalities, demoProperties, demoSearchResponse } from "@/lib/demo-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  search: async (query: string) =>
    request<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify({ query })
    }).catch(() => demoSearchResponse(query)),
  listProperties: () => request<Property[]>("/properties").catch(() => demoProperties),
  aggregateProperties: (place = "Sector V Kolkata", sources = ["magicbricks", "99acres", "nobroker", "broker_crm"]) => {
    const params = new URLSearchParams({ place });
    sources.forEach((source) => params.append("sources", source));
    return request<Property[]>(`/properties/aggregate?${params.toString()}`).catch(() => demoProperties);
  },
  listAggregateSources: () =>
    request<Array<{ id: string; name: string; role: string; ingestion_methods: string[]; status: string; note: string }>>("/properties/aggregate/sources"),
  listOpenDataProperties: (place = "Sector V Kolkata", sources = ["osm", "mapbox"]) => {
    const params = new URLSearchParams({ place });
    sources.forEach((source) => params.append("sources", source));
    return request<Property[]>(`/properties/open-data?${params.toString()}`).catch(() => demoProperties);
  },
  listPropertySources: () => request<Array<{ id: string; name: string; kind: string; note: string }>>("/properties/open-data/sources"),
  getProperty: (id: string) =>
    request<Property>(`/properties/${id}`).catch(() => demoProperties.find((property) => property._id === id) ?? demoProperties[0]),
  listLocalities: () => request<Locality[]>("/localities").catch(() => demoLocalities),
  getLocality: (id: string) =>
    request<Locality>(`/localities/${id}`).catch(() => demoLocalities.find((locality) => locality._id === id) ?? demoLocalities[0]),
  commute: (payload: { origin: string; destination: string; modes?: string[] }) =>
    request<CommuteEstimate[]>("/commute/estimate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  chat: (message: string) =>
    request<{ answer: string; context: SearchResponse }>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message })
    })
};
