"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, MapPin, Printer, Share2 } from "lucide-react";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { useShortlistStore } from "@/store/shortlist-store";
import type { Property } from "@/types";
import styles from "./page.module.css";

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function DecisionPage() {
  const params = useSearchParams();
  const replaceFromShare = useShortlistStore((state) => state.replaceFromShare);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const ids = useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 20), [params]);
  const query = params.get("q") ?? "Shared relocation shortlist";
  const profile = params.get("profile") ?? "balanced";
  const city = params.get("city") ?? "Unknown city";
  const constraints = params.get("constraints") ?? "{}";

  useEffect(() => {
    let active = true;
    Promise.all(ids.map((id) => api.getProperty(id)))
      .then((items) => items.filter((item, index) => item && item._id === ids[index]))
      .then((items) => {
        if (!active) return;
        setProperties(items);
        replaceFromShare(items);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [ids.join(","), replaceFromShare]);

  function downloadMarkdown() {
    const lines = ["# Relocation decision brief", "", `City: ${city}`, `Persona: ${profile}`, `Search: ${query}`, `Constraints: ${constraints}`, ""];
    properties.slice(0, 3).forEach((property, index) => {
      const coords = property.location?.coordinates;
      const map = coords ? `https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}#map=16/${coords[1]}/${coords[0]}` : "Map unavailable";
      const monthly = property.rent + (property.maintenance ?? 0) + (property.brokerage ?? 0) / 12;
      lines.push(`## ${index + 1}. ${property.title}`, "", `- Locality: ${property.locality ?? property.locality_id}`, `- Listed rent: ${money(property.rent)}`, `- Estimated monthly cost: ${money(monthly)}`, `- Commute: ${property.commute_estimate_minutes ?? "TBD"} min`, `- Deposit: ${property.deposit != null ? money(property.deposit) : "TBD"}`, `- Map: ${map}`, `- Pros: ${property.amenities.slice(0, 5).join(", ") || "Review listing"}`, "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "relocation-decision-brief.md";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}><Share2 size={13}/> Shared decision</span>
            <h1>Relocation shortlist</h1>
            <p>{city} · {profile.replaceAll("_", " ")} persona</p>
            <small>{query}</small>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={downloadMarkdown} disabled={!properties.length}><Download size={14}/> Markdown</button>
            <button type="button" onClick={() => window.print()} disabled={!properties.length}><Printer size={14}/> Print / Save PDF</button>
          </div>
        </header>

        {loading && <p className={styles.state}>Loading shared properties…</p>}
        {!loading && !properties.length && <p className={styles.state}>No valid properties were found in this shared decision link.</p>}
        <section className={styles.grid}>
          {properties.map((property, index) => {
            const coords = property.location?.coordinates;
            const monthly = property.rent + (property.maintenance ?? 0) + (property.brokerage ?? 0) / 12;
            return <article key={property._id} className={styles.card}>
              <span className={styles.rank}>#{index + 1}</span>
              <h2><Link href={`/property/${property._id}`}>{property.title}</Link></h2>
              <p className={styles.location}><MapPin size={13}/>{property.locality ?? property.locality_id}, {property.city ?? city}</p>
              <dl>
                <div><dt>Listed rent</dt><dd>{money(property.rent)}</dd></div>
                <div><dt>Est. monthly cost</dt><dd>{money(monthly)}</dd></div>
                <div><dt>Commute</dt><dd>{property.commute_estimate_minutes ?? "TBD"} min</dd></div>
                <div><dt>Deposit</dt><dd>{property.deposit != null ? money(property.deposit) : "TBD"}</dd></div>
              </dl>
              <div className={styles.tags}>{property.amenities.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
              {coords && <a className={styles.mapLink} href={`https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}#map=16/${coords[1]}/${coords[0]}`} target="_blank" rel="noreferrer">Open commute map</a>}
            </article>;
          })}
        </section>
        <section className={styles.config}><strong>Decision context</strong><code>{constraints}</code></section>
      </main>
    </>
  );
}

export default function ShortlistPage() {
  return <Suspense fallback={<p>Loading shortlist…</p>}><DecisionPage /></Suspense>;
}
