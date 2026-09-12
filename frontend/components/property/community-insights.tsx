"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, TrendingDown } from "lucide-react";
import { api, type CommunityInsights as CommunityInsightsData } from "@/lib/api";
import type { Property } from "@/types";
import styles from "./community-insights.module.css";

export function CommunityInsights({ property }: { property: Property }) {
  const [data, setData] = useState<CommunityInsightsData | null>(null);
  useEffect(() => {
    let active = true;
    void api.getCommunityInsights(property.locality_id, property._id).then((value) => { if (active) setData(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [property.locality_id, property._id]);

  const href = `/submit-rent?propertyId=${encodeURIComponent(property._id)}&localityId=${encodeURIComponent(property.locality_id)}&listedRent=${property.rent}`;
  if (!data || data.sample_size === 0) return <Link href={href} className={styles.empty}><Users size={10}/> Add first community rent insight</Link>;

  return (
    <div className={styles.widget}>
      <div><Users size={10}/><span>{data.sample_size} community reports</span></div>
      <div><TrendingDown size={10}/><strong>{data.average_savings_percent}% avg. negotiated saving</strong></div>
      <div><span>Negotiation power</span><b>{data.negotiation_power_index}/100</b></div>
      {data.median_negotiated_rent != null && <p>Real median: ₹{Math.round(data.median_negotiated_rent).toLocaleString("en-IN")}/mo</p>}
      <Link href={href}>Share your rent</Link>
    </div>
  );
}
