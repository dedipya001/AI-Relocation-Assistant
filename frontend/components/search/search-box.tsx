"use client";

import { FormEvent } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSearchStore } from "@/store/search-store";
import styles from "./search-box.module.css";

export function SearchBox() {
  const { query, setQuery, runSearch, isLoading } = useSearchStore();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <Textarea value={query} onChange={(event) => setQuery(event.target.value)} aria-label="AI relocation prompt" />
      <div className={styles.actions}>
        <Button type="submit" disabled={isLoading}>
          <Search size={17} />
          {isLoading ? "Thinking" : "Find best areas"}
        </Button>
        <Button type="button" variant="secondary">
          <SlidersHorizontal size={17} />
          Filters
        </Button>
      </div>
    </form>
  );
}
