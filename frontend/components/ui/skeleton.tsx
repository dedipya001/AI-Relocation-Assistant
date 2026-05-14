import { cn } from "@/lib/utils";
import styles from "./skeleton.module.css";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn(styles.skeleton, className)} />;
}
