import Link from "next/link";
import { ArrowRight, Building, MapPinned, ShieldCheck, Wifi } from "lucide-react";
import { Nav } from "@/components/nav";
import { RelocationMap } from "@/components/map/relocation-map";
import { SearchBox } from "@/components/search/search-box";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

const signals = [
  { label: "Commute reliability", icon: MapPinned, value: "Peak-aware" },
  { label: "Actual rent", icon: Building, value: "Crowdsourced" },
  { label: "Women safety", icon: ShieldCheck, value: "Scored" },
  { label: "Internet quality", icon: Wifi, value: "Tracked" }
];

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>AI relocation intelligence</p>
            <h1 className={styles.headline}>Find where life works near your office.</h1>
            <p className={styles.copy}>
              Search with natural language and rank homes by commute, real rent signals, safety, internet, food, and daily-life fit.
            </p>
          </div>
          <Card className={styles.searchCard}>
            <SearchBox />
          </Card>
          <div className={styles.signals}>
            {signals.map((signal) => (
              <Card key={signal.label} className={styles.signal}>
                <signal.icon size={18} className={styles.signalIcon} />
                <p className={styles.signalValue}>{signal.value}</p>
                <p className={styles.signalLabel}>{signal.label}</p>
              </Card>
            ))}
          </div>
          <Button asChild variant="secondary">
            <Link href="/search">
              Open full search <ArrowRight size={16} />
            </Link>
          </Button>
        </section>
        <RelocationMap />
      </main>
    </>
  );
}
