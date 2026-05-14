import { notFound } from "next/navigation";
import { Activity, Shield, Utensils, Wifi } from "lucide-react";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function LocalityPage({ params }: { params: { id: string } }) {
  let locality;
  try {
    locality = await api.getLocality(params.id);
  } catch {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div>
            <h1 className="text-3xl font-semibold">{locality.name}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/68">{locality.summary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Score icon={Shield} label="Safety" value={locality.scores.overall} />
              <Score icon={Wifi} label="Internet" value={locality.scores.internet} />
              <Score icon={Utensils} label="Food" value={locality.scores.food_access} />
              <Score icon={Activity} label="Commute" value={locality.scores.commute_reliability} />
            </div>
          </div>
          <Card className="p-4">
            <h2 className="font-semibold">Nearby essentials</h2>
            <div className="mt-3 space-y-3">
              {locality.essentials.map((place) => (
                <div key={place.name} className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                  <span>{place.name}</span>
                  <span>{Math.round(place.distance_meters / 100) / 10} km</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}

function Score({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: number }) {
  return (
    <Card className="p-4">
      <Icon size={18} className="text-primary" />
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-foreground/60">{label}</p>
    </Card>
  );
}
