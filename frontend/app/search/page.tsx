import { Nav } from "@/components/nav";
import { SearchClient } from "./search-client";
import styles from "./page.module.css";

export default function SearchPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <SearchClient />
      </main>
    </>
  );
}
