import { Injectable } from '@angular/core';
import { DemoDataService } from './demo-data.service';
import type {
  SearchResponse, Locality, Property, CommuteEstimate,
  ScoringProfile, ScoringWeights, HardConstraints, Recommendation, SearchOptions
} from '../models/relocation.models';

const API_URL = (typeof window !== 'undefined' && (window as any).__env?.API_URL)
  ?? 'http://localhost:8001/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private demo: DemoDataService) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    try {
      const res = await request<SearchResponse>('/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          profile: options?.profile,
          weights: options?.weights,
          hard_constraints: options?.hard_constraints,
        }),
      });
      if (!res || !res.properties || res.properties.length === 0) {
        return this.demo.searchResponse(query);
      }
      return res;
    } catch {
      return this.demo.searchResponse(query);
    }
  }

  async listLocalities(): Promise<Locality[]> {
    try {
      return await request<Locality[]>('/localities');
    } catch {
      return this.demo.localities;
    }
  }

  async getLocality(id: string): Promise<Locality> {
    try {
      return await request<Locality>(`/localities/${id}`);
    } catch {
      return this.demo.getLocality(id);
    }
  }

  async listProperties(): Promise<Property[]> {
    try {
      return await request<Property[]>('/properties');
    } catch {
      return this.demo.properties;
    }
  }

  async getProperty(id: string): Promise<Property> {
    try {
      return await request<Property>(`/properties/${id}`);
    } catch {
      return this.demo.getProperty(id);
    }
  }

  async chat(message: string): Promise<{ answer: string; context: SearchResponse }> {
    try {
      return await request<{ answer: string; context: SearchResponse }>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    } catch {
      return {
        answer: `I'm currently running in offline demo mode. Your question was: "${message}". In live mode, I'd analyze commute patterns, safety data, and rental intelligence to give you a personalized answer.`,
        context: this.demo.searchResponse(message),
      };
    }
  }

  async commute(payload: { origin: string; destination: string; modes?: string[] }): Promise<CommuteEstimate[]> {
    return request<CommuteEstimate[]>('/commute/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listScoringProfiles(): Promise<{ profiles: ScoringProfile[]; presets: Record<ScoringProfile, ScoringWeights> }> {
    return request('/recommendations/profiles');
  }
}
