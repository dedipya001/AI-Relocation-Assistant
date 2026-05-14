import Image from "next/image";
import Link from "next/link";
import { Clock, ExternalLink, MapPin, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatRent } from "@/lib/utils";
import type { Property } from "@/types";

const fallbackImages = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80"
];

export function PropertyCard({ property, index = 0 }: { property: Property; index?: number }) {
  const lowest = property.lowest_price;
  return (
    <Card className="overflow-hidden">
      <div className="relative h-40">
        <Image src={fallbackImages[index % fallbackImages.length]} alt="" fill className="object-cover" sizes="420px" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/property/${property._id}`} className="font-semibold hover:text-primary">
              {property.title}
            </Link>
            <p className="mt-1 text-sm text-foreground/60">{property.property_type} · {property.furnishing ?? "furnishing varies"}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatRent(property.rent)}</p>
            <p className="text-xs text-foreground/55">per month</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-foreground/70">
          {property.nearby_metro && (
            <span className="flex items-center gap-2">
              <MapPin size={15} /> {property.nearby_metro} metro
            </span>
          )}
          {property.commute_estimate_minutes && (
            <span className="flex items-center gap-2">
              <Clock size={15} /> {property.commute_estimate_minutes} min office commute
            </span>
          )}
          {lowest && (
            <span className="flex items-center gap-2 text-primary">
              <Sparkles size={15} /> Lowest price on {lowest.source}: {formatRent(lowest.rent)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {property.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium">
              {amenity}
            </span>
          ))}
        </div>
        {property.source_url && (
          <a href={property.source_url} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Source <ExternalLink size={14} />
          </a>
        )}
      </div>
    </Card>
  );
}
