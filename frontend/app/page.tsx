import Link from "next/link";
import { ArrowRight, Building, MapPinned, ShieldCheck, Wifi } from "lucide-react";
import { Nav } from "@/components/nav";
import { RelocationMap } from "@/components/map/relocation-map";
import { SearchBox } from "@/components/search/search-box";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[460px_1fr]">
        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-primary">AI relocation intelligence</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Find where life works near your office.</h1>
            <p className="mt-4 text-base leading-7 text-foreground/68">
              Search with natural language and rank homes by commute, real rent signals, safety, internet, food, and daily-life fit.
            </p>
          </div>
          <Card className="p-4 shadow-soft">
            <SearchBox />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {signals.map((signal) => (
              <Card key={signal.label} className="p-3">
                <signal.icon size={18} className="text-primary" />
                <p className="mt-2 text-sm font-semibold">{signal.value}</p>
                <p className="text-xs text-foreground/58">{signal.label}</p>
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
