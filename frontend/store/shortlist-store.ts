"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HardConstraints, Property, ScoringProfile } from "@/types";
import type { SupportedCity } from "@/store/search-store";

export type SavedSearch = {
  id: string;
  label: string;
  query: string;
  profile: ScoringProfile;
  hardConstraints: Partial<HardConstraints>;
  city: SupportedCity;
  createdAt: string;
};

export type PriceAlert = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  channel: "email" | "webhook";
  target: string;
  baselineRent: number;
  createdAt: string;
};

type ShortlistState = {
  savedProperties: Property[];
  savedSearches: SavedSearch[];
  priceAlerts: PriceAlert[];
  drawerOpen: boolean;
  toggleProperty: (property: Property) => void;
  removeProperty: (propertyId: string) => void;
  isSaved: (propertyId: string) => boolean;
  replaceFromShare: (properties: Property[]) => void;
  saveSearch: (input: Omit<SavedSearch, "id" | "createdAt">) => void;
  removeSearch: (id: string) => void;
  registerAlert: (input: Omit<PriceAlert, "id" | "createdAt">) => void;
  removeAlert: (id: string) => void;
  setDrawerOpen: (open: boolean) => void;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useShortlistStore = create<ShortlistState>()(
  persist(
    (set, get) => ({
      savedProperties: [],
      savedSearches: [],
      priceAlerts: [],
      drawerOpen: false,
      toggleProperty: (property) =>
        set((state) => {
          const exists = state.savedProperties.some((item) => item._id === property._id);
          return {
            savedProperties: exists
              ? state.savedProperties.filter((item) => item._id !== property._id)
              : [...state.savedProperties, property],
          };
        }),
      removeProperty: (propertyId) =>
        set((state) => ({
          savedProperties: state.savedProperties.filter((item) => item._id !== propertyId),
        })),
      isSaved: (propertyId) => get().savedProperties.some((item) => item._id === propertyId),
      replaceFromShare: (properties) => set({ savedProperties: properties }),
      saveSearch: (input) =>
        set((state) => ({
          savedSearches: [
            {
              ...input,
              id: uid("search"),
              createdAt: new Date().toISOString(),
            },
            ...state.savedSearches.filter(
              (item) => !(item.query === input.query && item.profile === input.profile && item.city === input.city)
            ),
          ].slice(0, 20),
        })),
      removeSearch: (id) =>
        set((state) => ({ savedSearches: state.savedSearches.filter((item) => item.id !== id) })),
      registerAlert: (input) =>
        set((state) => ({
          priceAlerts: [
            {
              ...input,
              id: uid("alert"),
              createdAt: new Date().toISOString(),
            },
            ...state.priceAlerts.filter(
              (item) => !(item.propertyId === input.propertyId && item.channel === input.channel && item.target === input.target)
            ),
          ],
        })),
      removeAlert: (id) => set((state) => ({ priceAlerts: state.priceAlerts.filter((item) => item.id !== id) })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: "relocation-shortlist-v1",
      partialize: (state) => ({
        savedProperties: state.savedProperties,
        savedSearches: state.savedSearches,
        priceAlerts: state.priceAlerts,
      }),
    }
  )
);

export function buildDecisionShareUrl(input: {
  properties: Property[];
  query: string;
  profile: ScoringProfile;
  city: SupportedCity;
  hardConstraints: Partial<HardConstraints>;
}) {
  const params = new URLSearchParams();
  params.set("ids", input.properties.map((property) => property._id).join(","));
  params.set("q", input.query);
  params.set("profile", input.profile);
  params.set("city", input.city);
  params.set("constraints", JSON.stringify(input.hardConstraints));
  return `/shortlist?${params.toString()}`;
}
