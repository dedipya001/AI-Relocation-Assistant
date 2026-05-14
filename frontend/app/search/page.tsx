import { Nav } from "@/components/nav";
import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SearchClient />
      </main>
    </>
  );
}
