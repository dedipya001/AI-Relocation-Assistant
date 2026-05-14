import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./input.module.css";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(styles.input, className)} {...props} />
));

Input.displayName = "Input";
