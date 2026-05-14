"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { SearchResponse } from "@/types";

type SearchState = {
  query: string;
  response?: SearchResponse;
  isLoading: boolean;
  error?: string;
  setQuery: (query: string) => void;
  runSearch: (query?: string) => Promise<void>;
};

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "I work in Sector V Kolkata, budget is 15k, need peaceful place, fast internet, good food nearby.",
  isLoading: false,
  setQuery: (query) => set({ query }),
  runSearch: async (query) => {
    const activeQuery = query ?? get().query;
    set({ isLoading: true, error: undefined, query: activeQuery });
    try {
      const response = await api.search(activeQuery);
      set({ response, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Search failed", isLoading: false });
    }
  }
}));
