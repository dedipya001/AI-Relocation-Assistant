import Image from "next/image";
import Link from "next/link";
import { Clock, ExternalLink, MapPin, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatRent } from "@/lib/utils";
import type { Property } from "@/types";
import styles from "./property-card.module.css";

const fallbackImages = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80"
];

export function PropertyCard({ property, index = 0 }: { property: Property; index?: number }) {
  const lowest = property.lowest_price;

  return (
    <Card className={styles.card}>
      <div className={styles.imageFrame}>
        <Image src={fallbackImages[index % fallbackImages.length]} alt="" fill className={styles.image} sizes="420px" />
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <div>
            <Link href={`/property/${property._id}`} className={styles.title}>
              {property.title}
            </Link>
            <p className={styles.meta}>{property.property_type} - {property.furnishing ?? "furnishing varies"}</p>
          </div>
          <div className={styles.price}>
            <p className={styles.rent}>{formatRent(property.rent)}</p>
            <p className={styles.period}>per month</p>
          </div>
        </div>
        <div className={styles.facts}>
          {property.nearby_metro && (
            <span className={styles.fact}>
              <MapPin size={15} /> {property.nearby_metro} metro
            </span>
          )}
          {property.commute_estimate_minutes && (
            <span className={styles.fact}>
              <Clock size={15} /> {property.commute_estimate_minutes} min office commute
            </span>
          )}
          {lowest && (
            <span className={styles.lowest}>
              <Sparkles size={15} /> Lowest price on {lowest.source}: {formatRent(lowest.rent)}
            </span>
          )}
        </div>
        <div className={styles.amenities}>
          {property.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className={styles.amenity}>
              {amenity}
            </span>
          ))}
        </div>
        {property.source_url && (
          <a href={property.source_url} className={styles.source}>
            Source <ExternalLink size={14} />
          </a>
        )}
      </div>
    </Card>
  );
}
