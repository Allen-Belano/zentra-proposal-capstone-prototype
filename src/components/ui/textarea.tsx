import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-2xl px-4 py-2.5 text-sm placeholder:text-muted-foreground border border-transparent bg-muted shadow-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-border focus-visible:border-ring/40 focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
