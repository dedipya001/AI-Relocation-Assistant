"use client";

import { useMemo, useState } from "react";
import { BarChart3, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type TelemetrySummary = {
  period: { days: number; from: string; to: string };
  total_profiles: number;
  age_groups: Record<string, number>;
  gender_categories: Record<string, number>;
  roles: Record<string, number>;
  cities: Record<string, number>;
  budget_bands: Record<string, number>;
  priorities: Record<string, number>;
  daily: Array<{ date: string; total_profiles: number }>;
  privacy: { raw_profiles_stored: false; identifiers_stored: false; note: string };
};

const LABELS: Record<string, string> = {
  "18-24": "18–24",
  "25-32": "25–32",
  "33-45": "33–45",
  "46+": "46+",
  prefer_not_to_say: "Prefer not to say",
  non_binary: "Non-binary",
  student_intern: "Student / Intern",
  tech_professional: "Tech professional",
  executive: "Executive",
  under_15k: "Under ₹15k",
  "15k_25k": "₹15k–25k",
  "25k_40k": "₹25k–40k",
  "40k_60k": "₹40k–60k",
  "60k_plus": "₹60k+",
  metro_transit: "Metro / transit",
  power_backup: "Power backup",
  work_cafes: "Work cafes",
  pet_friendly: "Pet friendly",
  food_access: "Food access",
};

function label(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function MetricList({ title, data, total }: { title: string; data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <section className={styles.metricCard}>
      <h2>{title}</h2>
      {!entries.length && <p className={styles.empty}>No events in this period.</p>}
      {entries.map(([key, count]) => {
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={key} className={styles.metricRow}>
            <div className={styles.metricMeta}>
              <span>{label(key)}</span>
              <strong>{count.toLocaleString("en-IN")} · {percent}%</strong>
            </div>
            <div className={styles.track}><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
          </div>
        );
      })}
    </section>
  );
}

export default function TelemetryAdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TelemetrySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTelemetry() {
    if (!adminKey.trim()) {
      setError("Enter the telemetry admin key.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/users/admin/telemetry?days=${days}`, {
        headers: { "x-admin-key": adminKey.trim() },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      setData(payload as TelemetrySummary);
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to load telemetry.");
    } finally {
      setIsLoading(false);
    }
  }

  const peakDay = useMemo(() => {
    if (!data?.daily?.length) return null;
    return [...data.daily].sort((a, b) => b.total_profiles - a.total_profiles)[0];
  }, [data]);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}><BarChart3 size={15} /> Admin analytics</p>
            <h1>Personalization telemetry</h1>
            <p>Aggregate adoption signals from the guest-tailoring flow. Individual visitor profiles and identifiers are never stored in this telemetry dataset.</p>
          </div>
          <div className={styles.security}><ShieldCheck size={20} /><span>Aggregate-only storage</span></div>
        </section>

        <section className={styles.accessPanel}>
          <div className={styles.field}>
            <label htmlFor="telemetry-key"><LockKeyhole size={14} /> Admin key</label>
            <Input id="telemetry-key" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Telemetry admin key" autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor="telemetry-days">Period</label>
            <select id="telemetry-days" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </select>
          </div>
          <Button onClick={() => void loadTelemetry()} disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? styles.spin : ""} /> {isLoading ? "Loading" : "Load dashboard"}
          </Button>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        {data && (
          <>
            <section className={styles.summaryGrid}>
              <div><span>Tailoring events</span><strong>{data.total_profiles.toLocaleString("en-IN")}</strong></div>
              <div><span>Period</span><strong>{data.period.days} days</strong><small>{data.period.from} → {data.period.to}</small></div>
              <div><span>Peak day</span><strong>{peakDay?.total_profiles ?? 0}</strong><small>{peakDay?.date ?? "No events"}</small></div>
              <div><span>Privacy</span><strong>Anonymous aggregates</strong><small>No user/email/IP fields</small></div>
            </section>

            <div className={styles.grid}>
              <MetricList title="Age bands" data={data.age_groups} total={data.total_profiles} />
              <MetricList title="Roles" data={data.roles} total={data.total_profiles} />
              <MetricList title="Cities" data={data.cities} total={data.total_profiles} />
              <MetricList title="Budget bands" data={data.budget_bands} total={data.total_profiles} />
              <MetricList title="Gender categories" data={data.gender_categories} total={data.total_profiles} />
              <MetricList title="Selected priorities" data={data.priorities} total={data.total_profiles} />
            </div>

            <section className={styles.privacyNote}>
              <ShieldCheck size={18} />
              <div><strong>Privacy guarantee</strong><p>{data.privacy.note}</p></div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
