import Link from "next/link";
import { Shield, Utensils, Wifi } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Locality } from "@/types";

export function LocalityCard({ locality }: { locality: Locality }) {
  return (
    <Card className="p-4">
      <Link href={`/locality/${locality._id}`} className="text-lg font-semibold hover:text-primary">
        {locality.name}
      </Link>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/68">{locality.summary}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric icon={Shield} label="Safety" value={locality.scores.overall} />
        <Metric icon={Wifi} label="Internet" value={locality.scores.internet} />
        <Metric icon={Utensils} label="Food" value={locality.scores.food_access} />
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <div className="flex items-center gap-1 text-xs text-foreground/60">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
