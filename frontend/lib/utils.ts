import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRent(value: number) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}
