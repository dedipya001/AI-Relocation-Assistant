import { Bus, Home, IndianRupee, Shield, Wifi } from "lucide-react";
import { Card } from "@/components/ui/card";

const filters = [
  { label: "Under 15k", icon: IndianRupee },
  { label: "PG or shared", icon: Home },
  { label: "Metro commute", icon: Bus },
  { label: "Women safety", icon: Shield },
  { label: "Fast internet", icon: Wifi }
];

export function FilterSidebar() {
  return (
    <aside className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-foreground/60">Quick filters</h2>
      {filters.map((filter) => (
        <Card key={filter.label} className="flex items-center gap-3 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <filter.icon size={17} />
          </span>
          <span className="text-sm font-medium">{filter.label}</span>
        </Card>
      ))}
    </aside>
  );
}
