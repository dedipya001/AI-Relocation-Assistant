"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { HardConstraints, ScoringProfile, SearchResponse } from "@/types";

type SearchState = {
  query: string;
  response?: SearchResponse;
  isLoading: boolean;
  error?: string;
  selectedProfile: ScoringProfile;
  hardConstraints: Partial<HardConstraints>;
  setQuery: (query: string) => void;
  setSelectedProfile: (profile: ScoringProfile) => Promise<void>;
  setHardConstraints: (constraints: Partial<HardConstraints>) => Promise<void>;
  runSearch: (
    query?: string,
    profile?: ScoringProfile,
    constraints?: Partial<HardConstraints>
  ) => Promise<void>;
};

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "I work in Sector V Kolkata, budget is 15k, need peaceful place, fast internet, good food nearby.",
  isLoading: false,
  selectedProfile: "balanced",
  hardConstraints: {},

  setQuery: (query) => set({ query }),

  setSelectedProfile: async (selectedProfile) => {
    set({ selectedProfile });
    await get().runSearch(get().query, selectedProfile, get().hardConstraints);
  },

  setHardConstraints: async (hardConstraints) => {
    set({ hardConstraints });
    await get().runSearch(get().query, get().selectedProfile, hardConstraints);
  },

  runSearch: async (query, profile, constraints) => {
    const activeQuery = query ?? get().query;
    const activeProfile = profile ?? get().selectedProfile;
    const activeConstraints = constraints ?? get().hardConstraints;

    set({ isLoading: true, error: undefined, query: activeQuery });
    try {
      const response = await api.search(activeQuery, {
        profile: activeProfile,
        hard_constraints: activeConstraints,
      });
      set({ response, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Search failed",
        isLoading: false,
      });
    }
  },
}));
