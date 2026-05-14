import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./textarea.module.css";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(styles.textarea, className)} {...props} />
));

Textarea.displayName = "Textarea";
