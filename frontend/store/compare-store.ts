"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_COMPARE = 4;

interface CompareState {
  propertyIds: string[];
  toggle: (propertyId: string) => void;
  remove: (propertyId: string) => void;
  clear: () => void;
  replace: (propertyIds: string[]) => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      propertyIds: [],
      toggle: (propertyId) =>
        set((state) => {
          if (state.propertyIds.includes(propertyId)) {
            return { propertyIds: state.propertyIds.filter((id) => id !== propertyId) };
          }
          if (state.propertyIds.length >= MAX_COMPARE) return state;
          return { propertyIds: [...state.propertyIds, propertyId] };
        }),
      remove: (propertyId) =>
        set((state) => ({ propertyIds: state.propertyIds.filter((id) => id !== propertyId) })),
      clear: () => set({ propertyIds: [] }),
      replace: (propertyIds) =>
        set({ propertyIds: Array.from(new Set(propertyIds.filter(Boolean))).slice(0, MAX_COMPARE) }),
    }),
    { name: "relocation-compare-v1" }
  )
);
