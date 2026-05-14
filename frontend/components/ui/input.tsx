import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none transition placeholder:text-foreground/45 focus:border-primary focus:ring-2 focus:ring-primary/15",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
