import { notFound } from "next/navigation";
import { Clock, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { demoProperties } from "@/lib/demo-data";
import { formatRent } from "@/lib/utils";
import styles from "./page.module.css";

export function generateStaticParams() {
  return demoProperties.map((property) => ({
    id: property._id,
  }));
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let property;
  try {
    property = await api.getProperty(id);
  } catch {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.layout}>
          <section>
            <div className={styles.heroImage} />
            <h1 className={styles.title}>{property.title}</h1>
            <p className={styles.meta}>{property.property_type} - {property.furnishing ?? "furnishing varies"}</p>
            <div className={styles.amenities}>
              {property.amenities.map((amenity) => (
                <span key={amenity} className={styles.amenity}>
                  {amenity}
                </span>
              ))}
            </div>
          </section>
          <aside className={styles.sidebar}>
            <Card className={styles.priceCard}>
              <p className={styles.price}>{formatRent(property.rent)}</p>
              <p className={styles.priceLabel}>listed rent per month</p>
              {property.lowest_price && (
                <p className={styles.lowestPrice}>
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
    <Card className={styles.metric}>
      <Icon size={18} className={styles.metricIcon} />
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
      </div>
    </Card>
  );
}
