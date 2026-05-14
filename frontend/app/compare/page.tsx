import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";

const rows = [
  ["Sector V", "78", "8 min", "Rs 9.5k", "86", "Best for shortest commute"],
  ["New Town", "82", "28 min", "Rs 14.5k", "84", "Best value and newer housing"],
  ["Lake Town", "76", "38 min", "Rs 11k", "78", "Best calmer residential feel"]
];

export default function ComparePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-semibold">Compare localities</h1>
        <Card className="mt-4 overflow-hidden">
          <div className="grid grid-cols-6 border-b border-border bg-muted px-4 py-3 text-sm font-semibold">
            <span>Locality</span>
            <span>Score</span>
            <span>Commute</span>
            <span>Rent from</span>
            <span>Internet</span>
            <span>AI read</span>
          </div>
          {rows.map((row) => (
            <div key={row[0]} className="grid grid-cols-6 px-4 py-4 text-sm odd:bg-white even:bg-background">
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </Card>
      </main>
    </>
  );
}
