import { notFound } from "next/navigation";
import { Clock, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatRent } from "@/lib/utils";

export default async function PropertyPage({ params }: { params: { id: string } }) {
  let property;
  try {
    property = await api.getProperty(params.id);
  } catch {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section>
            <div className="h-72 rounded-lg bg-[url('https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center" />
            <h1 className="mt-5 text-3xl font-semibold">{property.title}</h1>
            <p className="mt-2 text-foreground/65">{property.property_type} · {property.furnishing ?? "furnishing varies"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <span key={amenity} className="rounded-lg bg-muted px-3 py-1 text-sm font-medium">
                  {amenity}
                </span>
              ))}
            </div>
          </section>
          <aside className="space-y-3">
            <Card className="p-4">
              <p className="text-2xl font-semibold">{formatRent(property.rent)}</p>
              <p className="text-sm text-foreground/60">listed rent per month</p>
              {property.lowest_price && (
                <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-primary">
                  Lowest price found online: {formatRent(property.lowest_price.rent)} on {property.lowest_price.source}
                </p>
              )}
            </Card>
            <Metric icon={Clock} label="Commute" value={`${property.commute_estimate_minutes ?? "TBD"} min`} />
            <Metric icon={MapPin} label="Nearby metro" value={property.nearby_metro ?? "TBD"} />
            <Metric icon={IndianRupee} label="Deposit" value={property.deposit ? formatRent(property.deposit) : "TBD"} />
            <Metric icon={ShieldCheck} label="Fair rent" value="Coming from crowdsourcing" />
          </aside>
        </div>
      </main>
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon size={18} className="text-primary" />
      <div>
        <p className="text-sm text-foreground/55">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </Card>
  );
}
