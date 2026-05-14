import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import styles from "./page.module.css";

const rows = [
  ["Sector V", "78", "8 min", "Rs 9.5k", "86", "Best for shortest commute"],
  ["New Town", "82", "28 min", "Rs 14.5k", "84", "Best value and newer housing"],
  ["Lake Town", "76", "38 min", "Rs 11k", "78", "Best calmer residential feel"]
];

export default function ComparePage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <h1 className={styles.title}>Compare localities</h1>
        <Card className={styles.tableCard}>
          <div className={styles.scroll}>
            <div className={styles.head}>
              <span>Locality</span>
              <span>Score</span>
              <span>Commute</span>
              <span>Rent from</span>
              <span>Internet</span>
              <span>AI read</span>
            </div>
            {rows.map((row) => (
              <div key={row[0]} className={styles.row}>
                {row.map((cell) => (
                  <span key={cell}>{cell}</span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </main>
    </>
  );
}
