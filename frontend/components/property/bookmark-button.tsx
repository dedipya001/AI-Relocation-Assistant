"use client";

import { Bookmark } from "lucide-react";
import type { Property } from "@/types";
import { useShortlistStore } from "@/store/shortlist-store";
import { useUserProfileStore } from "@/store/user-profile-store";
import styles from "./bookmark-button.module.css";

export function BookmarkButton({ property, compact = false }: { property: Property; compact?: boolean }) {
  const savedProperties = useShortlistStore((state) => state.savedProperties);
  const toggleProperty = useShortlistStore((state) => state.toggleProperty);
  const setDrawerOpen = useShortlistStore((state) => state.setDrawerOpen);
  const authToken = useUserProfileStore((state) => state.authToken);
  const saveProperty = useUserProfileStore((state) => state.saveProperty);
  const removeProperty = useUserProfileStore((state) => state.removeProperty);
  const requestLogin = useUserProfileStore((state) => state.requestLogin);
  const saved = savedProperties.some((item) => item._id === property._id);

  return (
    <button
      type="button"
      className={`${styles.button} ${compact ? styles.compact : ""} ${saved ? styles.saved : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${property.title} from shortlist` : `Save ${property.title} to shortlist`}
      onClick={(event) => {
        event.stopPropagation();
        toggleProperty(property);
        if (saved) {
          void removeProperty(property._id);
          return;
        }
        void saveProperty(property._id);
        setDrawerOpen(true);
        if (!authToken) requestLogin("shortlist");
      }}
    >
      <Bookmark size={compact ? 12 : 15} fill={saved ? "currentColor" : "none"} />
      {!compact && <span>{saved ? "Saved" : "Save home"}</span>}
    </button>
  );
}
