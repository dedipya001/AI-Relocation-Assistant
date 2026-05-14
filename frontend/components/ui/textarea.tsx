import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full resize-none rounded-lg border border-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-foreground/45 focus:border-primary focus:ring-2 focus:ring-primary/15",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
