import { notFound } from "next/navigation";
import { Activity, Shield, Utensils, Wifi } from "lucide-react";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import styles from "./page.module.css";

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
      <main className={styles.main}>
        <section className={styles.layout}>
          <div>
            <h1 className={styles.title}>{locality.name}</h1>
            <p className={styles.summary}>{locality.summary}</p>
            <div className={styles.scores}>
              <Score icon={Shield} label="Safety" value={locality.scores.overall} />
              <Score icon={Wifi} label="Internet" value={locality.scores.internet} />
              <Score icon={Utensils} label="Food" value={locality.scores.food_access} />
              <Score icon={Activity} label="Commute" value={locality.scores.commute_reliability} />
            </div>
          </div>
          <Card className={styles.essentials}>
            <h2 className={styles.essentialsTitle}>Nearby essentials</h2>
            <div className={styles.placeList}>
              {locality.essentials.map((place) => (
                <div key={place.name} className={styles.place}>
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
    <Card className={styles.scoreCard}>
      <Icon size={18} className={styles.scoreIcon} />
      <p className={styles.scoreValue}>{value}</p>
      <p className={styles.scoreLabel}>{label}</p>
    </Card>
  );
}
