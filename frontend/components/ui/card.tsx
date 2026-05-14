import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./card.module.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.card, className)} {...props} />;
}
