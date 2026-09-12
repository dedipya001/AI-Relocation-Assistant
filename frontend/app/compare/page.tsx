"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Share2, Trophy, ArrowLeft } from "lucide-react";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { useCompareStore } from "@/store/compare-store";
import type { Locality, Property } from "@/types";
import styles from "./page.module.css";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const num = (value?: number | null) => typeof value === "number" && Number.isFinite(value) ? value : 0;

function effectiveMonthlyCost(property: Property) {
  const maintenance = num(property.maintenance);
  const depositOpportunityCost = num(property.deposit) * 0.06 / 12;
  const brokerageAmortization = num(property.brokerage) / 12;
  return property.rent + maintenance + depositOpportunityCost + brokerageAmortization;
}

function commuteFor(property: Property) {
  const base = Math.max(1, num(property.commute_estimate_minutes) || Math.round((num(property.distance_to_office_km) || 5) * 4));
  const distance = Math.max(0.5, num(property.distance_to_office_km) || base / 4);
  return {
    metro: { minutes: Math.max(8, Math.round(base * 0.9)), cost: Math.round(distance * 3.5) },
    bus: { minutes: Math.max(10, Math.round(base * 1.2)), cost: Math.round(distance * 2.2) },
    cab: { minutes: Math.max(6, Math.round(base * 0.78)), cost: Math.round(45 + distance * 16) },
    walk: { minutes: Math.round(distance * 12), cost: 0 },
  };
}

function localityFor(property: Property, localities: Locality[]) {
  return localities.find((loc) => loc._id === property.locality_id) ??
    localities.find((loc) => loc.name.toLowerCase() === property.locality?.toLowerCase()) ?? null;
}

export default function ComparePage() {
  const storedIds = useCompareStore((state) => state.propertyIds);
  const replace = useCompareStore((state) => state.replace);
  const [properties, setProperties] = useState<Property[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const queryIds = new URLSearchParams(window.location.search).get("ids")?.split(",").map(decodeURIComponent).filter(Boolean).slice(0, 4) ?? [];
    const ids = queryIds.length ? queryIds : storedIds.slice(0, 4);
    if (queryIds.length) replace(queryIds);
    void Promise.all([
      Promise.all(ids.map((id) => api.getProperty(id))),
      api.listLocalities(),
    ]).then(([props, locs]) => {
      const unique = Array.from(new Map(props.filter(Boolean).map((property) => [property._id, property])).values());
      setProperties(unique);
      setLocalities(locs);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => properties.map((property) => ({ property, locality: localityFor(property, localities), cost: effectiveMonthlyCost(property), commute: commuteFor(property) })), [properties, localities]);
  const minCost = Math.min(...rows.map((row) => row.cost), Number.POSITIVE_INFINITY);
  const minMetro = Math.min(...rows.map((row) => row.commute.metro.minutes), Number.POSITIVE_INFINITY);
  const maxSafety = Math.max(...rows.map((row) => row.locality?.scores.overall ?? 0), 0);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: "Property comparison", url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  if (loading) return <><Nav /><main className={styles.main}><p>Loading comparison…</p></main></>;
  if (properties.length < 2) return <><Nav /><main className={styles.main}><div className={styles.empty}><h1>Select at least two homes</h1><p>Choose 2–4 properties from search results, then open the comparison tray.</p><Link href="/search"><ArrowLeft size={15}/> Back to search</Link></div></main></>;

  const metrics = [
    ["Overall safety", (loc: Locality | null) => loc?.scores.overall ?? 0],
    ["Women safety", (loc: Locality | null) => loc?.scores.women_safety ?? 0],
    ["Late night", (loc: Locality | null) => loc?.scores.late_night ?? 0],
    ["Internet", (loc: Locality | null) => loc?.scores.internet ?? 0],
    ["Food access", (loc: Locality | null) => loc?.scores.food_access ?? 0],
  ] as const;

  return (
    <><Nav /><main className={styles.main}>
      <div className={styles.hero}>
        <div><p className={styles.eyebrow}>Decision matrix</p><h1>Compare {properties.length} homes side by side</h1><p>Financial, commute and locality signals from the same data used by search.</p></div>
        <div className={styles.actions}><button onClick={share}><Share2 size={15}/>{copied ? "Copied" : "Share"}</button><button onClick={() => window.print()}><Download size={15}/> Export PDF</button></div>
      </div>

      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Metric</th>{rows.map(({property}) => <th key={property._id}><strong>{property.locality ?? property.title}</strong><span>{property.property_type}</span></th>)}</tr></thead>
          <tbody>
            <tr><th>Listed rent</th>{rows.map(({property}) => <td key={property._id}>{money(property.rent)}</td>)}</tr>
            <tr><th>Maintenance</th>{rows.map(({property}) => <td key={property._id}>{money(num(property.maintenance))}</td>)}</tr>
            <tr><th>Security deposit</th>{rows.map(({property}) => <td key={property._id}>{money(num(property.deposit))}</td>)}</tr>
            <tr><th>Brokerage</th>{rows.map(({property}) => <td key={property._id}>{money(num(property.brokerage))}</td>)}</tr>
            <tr className={styles.primaryRow}><th>Effective monthly true cost <small>rent + maintenance + deposit × 6% ÷ 12 + brokerage ÷ 12</small></th>{rows.map((row) => <td key={row.property._id}>{row.cost === minCost && <Trophy size={14}/>}<strong>{money(Math.round(row.cost))}</strong></td>)}</tr>
            <tr><th>Metro</th>{rows.map((row) => <td key={row.property._id}>{row.commute.metro.minutes === minMetro && <Trophy size={14}/>} {row.commute.metro.minutes} min · {money(row.commute.metro.cost)}</td>)}</tr>
            <tr><th>Bus</th>{rows.map((row) => <td key={row.property._id}>{row.commute.bus.minutes} min · {money(row.commute.bus.cost)}</td>)}</tr>
            <tr><th>Cab / Auto</th>{rows.map((row) => <td key={row.property._id}>{row.commute.cab.minutes} min · {money(row.commute.cab.cost)}</td>)}</tr>
            <tr><th>Walking</th>{rows.map((row) => <td key={row.property._id}>{row.commute.walk.minutes} min · Free</td>)}</tr>
            <tr><th>Nearest metro</th>{rows.map(({property}) => <td key={property._id}>{property.nearby_metro ?? "Not recorded"}</td>)}</tr>
          </tbody>
        </table>
      </section>

      <section className={styles.livability}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Locality livability</p><h2>Score comparison</h2></div><span>Higher is better · /100</span></div>
        <div className={styles.scoreGrid}>{rows.map((row) => <article key={row.property._id} className={styles.scoreCard}><div className={styles.scoreTitle}><strong>{row.property.locality ?? row.property.title}</strong>{(row.locality?.scores.overall ?? 0) === maxSafety && maxSafety > 0 && <span><Trophy size={12}/> Safety leader</span>}</div>{metrics.map(([label,get]) => { const value=get(row.locality); return <div key={label} className={styles.barRow}><span>{label}</span><div className={styles.bar}><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div><b>{value || "—"}</b></div>; })}</article>)}</div>
      </section>

      <p className={styles.note}>Commute mode times/costs are deterministic planning estimates derived from stored distance and commute signals. Use the interactive map for route-specific live contours.</p>
    </main></>
  );
}
