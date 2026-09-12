"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bookmark, Bell, Download, Link2, Search, Smartphone, Trash2, X } from "lucide-react";
import { buildDecisionShareUrl, useShortlistStore } from "@/store/shortlist-store";
import { useSearchStore } from "@/store/search-store";
import { useUserProfileStore } from "@/store/user-profile-store";
import type { Property } from "@/types";
import styles from "./shortlist-drawer.module.css";

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function latestObservedRent(property: Property) {
  const history = (property.price_history ?? [])
    .filter((item) => Number.isFinite(item.rent))
    .sort((a, b) => String(a.observed_at ?? "").localeCompare(String(b.observed_at ?? "")));
  return history.length ? history[history.length - 1].rent : property.rent;
}

function buildMarkdown(properties: Property[], query: string) {
  const top = properties.slice(0, 3);
  const lines = [
    "# Relocation decision brief",
    "",
    `Search context: ${query}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
  ];
  top.forEach((property, index) => {
    const coordinates = property.location?.coordinates;
    const map = coordinates
      ? `https://www.openstreetmap.org/?mlat=${coordinates[1]}&mlon=${coordinates[0]}#map=16/${coordinates[1]}/${coordinates[0]}`
      : "Map coordinates unavailable";
    const effective = property.rent + (property.maintenance ?? 0) + (property.brokerage ?? 0) / 12;
    lines.push(
      `## ${index + 1}. ${property.title}`,
      "",
      `- Locality: ${property.locality ?? property.locality_id}`,
      `- Listed rent: ${money(property.rent)}/month`,
      `- Estimated recurring monthly cost: ${money(effective)}`,
      `- Deposit: ${property.deposit != null ? money(property.deposit) : "Not provided"}`,
      `- Commute: ${property.commute_estimate_minutes != null ? `${property.commute_estimate_minutes} min` : "Not provided"}`,
      `- Map: ${map}`,
      `- Pros: ${(property.amenities ?? []).slice(0, 4).join(", ") || "No structured amenities"}`,
      `- Trade-offs: ${property.deposit && property.deposit > property.rent * 2 ? "Higher deposit lock-up" : "Review source listing and locality trade-offs before deciding"}`,
      ""
    );
  });
  return lines.join("\n");
}

export function ShortlistDrawer() {
  const savedProperties = useShortlistStore((state) => state.savedProperties);
  const savedSearches = useShortlistStore((state) => state.savedSearches);
  const priceAlerts = useShortlistStore((state) => state.priceAlerts);
  const drawerOpen = useShortlistStore((state) => state.drawerOpen);
  const removeLocalProperty = useShortlistStore((state) => state.removeProperty);
  const saveSearch = useShortlistStore((state) => state.saveSearch);
  const removeSearch = useShortlistStore((state) => state.removeSearch);
  const registerAlert = useShortlistStore((state) => state.registerAlert);
  const setDrawerOpen = useShortlistStore((state) => state.setDrawerOpen);

  const authToken = useUserProfileStore((state) => state.authToken);
  const userEmail = useUserProfileStore((state) => state.userEmail);
  const requestLogin = useUserProfileStore((state) => state.requestLogin);
  const removeSyncedProperty = useUserProfileStore((state) => state.removeProperty);

  const { query, selectedProfile, selectedCity, hardConstraints, setQuery, setCity, setSelectedProfile, setHardConstraints } = useSearchStore();
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [alertChannel, setAlertChannel] = useState<"email" | "webhook">("email");
  const [alertTarget, setAlertTarget] = useState("");

  const totalRent = useMemo(() => savedProperties.reduce((sum, item) => sum + item.rent, 0), [savedProperties]);
  const commuteValues = savedProperties.map((item) => item.commute_estimate_minutes).filter((item): item is number => typeof item === "number");
  const commuteRange = commuteValues.length ? `${Math.min(...commuteValues)}–${Math.max(...commuteValues)} min` : "No commute data";

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${buildDecisionShareUrl({ properties: savedProperties, query, profile: selectedProfile, city: selectedCity, hardConstraints })}`
    : "";

  async function loadSavedSearch(searchId: string) {
    const saved = savedSearches.find((item) => item.id === searchId);
    if (!saved) return;
    await setCity(saved.city);
    setQuery(saved.query);
    await setHardConstraints(saved.hardConstraints);
    await setSelectedProfile(saved.profile);
    setDrawerOpen(false);
  }

  function downloadMarkdown() {
    const markdown = buildMarkdown(savedProperties, query);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relocation-decision-brief.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function removeProperty(propertyId:string){
    removeLocalProperty(propertyId);
    void removeSyncedProperty(propertyId);
  }

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setDrawerOpen(true)} aria-label="Open shortlist">
        <Bookmark size={16} />
        <span>Shortlist</span>
        {savedProperties.length > 0 && <b>{savedProperties.length}</b>}
      </button>

      {drawerOpen && <button className={styles.backdrop} aria-label="Close shortlist" onClick={() => setDrawerOpen(false)} />}
      <aside className={`${styles.drawer} ${drawerOpen ? styles.open : ""}`} aria-hidden={!drawerOpen}>
        <div className={styles.header}>
          <div><strong>Your relocation shortlist</strong><span>{authToken?`Synced to ${userEmail??"your account"}`:"Saved locally on this browser"}</span></div>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close"><X size={17} /></button>
        </div>

        <div className={styles.summary}>
          <div><span>Homes</span><strong>{savedProperties.length}</strong></div>
          <div><span>Total listed rent</span><strong>{money(totalRent)}</strong></div>
          <div><span>Commute range</span><strong>{commuteRange}</strong></div>
        </div>

        <div className={styles.toolbar}>
          <button type="button" disabled={!savedProperties.length} onClick={() => navigator.clipboard.writeText(shareUrl)}><Link2 size={13}/> Copy decision link</button>
          <button type="button" disabled={!savedProperties.length} onClick={downloadMarkdown}><Download size={13}/> Markdown brief</button>
          <button type="button" onClick={()=>{if(!authToken)requestLogin("sync");}} disabled={Boolean(authToken)}><Smartphone size={13}/>{authToken?"Synced":"Sync to mobile"}</button>
          {savedProperties.length > 0 && <Link href={buildDecisionShareUrl({ properties: savedProperties, query, profile: selectedProfile, city: selectedCity, hardConstraints })}>Open / PDF</Link>}
        </div>

        <section className={styles.section}>
          <h3>Saved homes</h3>
          {!savedProperties.length && <p className={styles.empty}>Bookmark properties from search results or a property detail page.</p>}
          {savedProperties.map((property) => {
            const observed = latestObservedRent(property);
            const dropped = observed < property.rent;
            const hasAlert = priceAlerts.some((item) => item.propertyId === property._id);
            return <div key={property._id} className={styles.item}>
              <div className={styles.itemMain}>
                <Link href={`/property/${property._id}`}>{property.title}</Link>
                <span>{money(property.rent)}/mo · {property.commute_estimate_minutes ?? "?"} min commute</span>
                {dropped && <em>Price history shows a lower observed rent: {money(observed)}</em>}
              </div>
              <div className={styles.itemActions}>
                <button type="button" title="Register price alert" onClick={() => {if(!authToken){requestLogin("price_alert");return;}setAlertFor(alertFor === property._id ? null : property._id);}}><Bell size={13}/>{hasAlert ? "Alert set" : "Alert"}</button>
                <button type="button" title="Remove" onClick={() => removeProperty(property._id)}><Trash2 size={13}/></button>
              </div>
              {alertFor === property._id && <div className={styles.alertForm}>
                <select value={alertChannel} onChange={(event) => setAlertChannel(event.target.value as "email" | "webhook")}><option value="email">Email simulation</option><option value="webhook">Webhook simulation</option></select>
                <input value={alertTarget} onChange={(event) => setAlertTarget(event.target.value)} placeholder={alertChannel === "email" ? "you@example.com" : "https://example.com/hook"}/>
                <button type="button" disabled={!alertTarget.trim()} onClick={() => { registerAlert({ propertyId: property._id, propertyTitle: property.title, channel: alertChannel, target: alertTarget.trim(), baselineRent: observed }); setAlertTarget(""); setAlertFor(null); }}>Register</button>
              </div>}
            </div>;
          })}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3>Saved searches</h3>
            <button type="button" onClick={() => saveSearch({ label: `${selectedCity} · ${selectedProfile.replaceAll("_", " ")}`, query, profile: selectedProfile, hardConstraints, city: selectedCity })}><Search size={12}/> Save current</button>
          </div>
          {!savedSearches.length && <p className={styles.empty}>Save the current city, prompt, persona, and hard constraints for later.</p>}
          {savedSearches.map((saved) => <div key={saved.id} className={styles.searchRow}><button type="button" className={styles.searchLoad} onClick={() => void loadSavedSearch(saved.id)}><strong>{saved.label}</strong><span>{saved.query}</span></button><button type="button" onClick={() => removeSearch(saved.id)} aria-label="Delete saved search"><Trash2 size={12}/></button></div>)}
        </section>
      </aside>
    </>
  );
}
