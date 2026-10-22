import * as React from "react";
import { cn } from "@/lib/utils";

// Rows have no dividers: the header sits in a rounded grey strip and rows highlight as rounded bands on hover.
export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-x-auto px-1 pb-3 pt-2">
    <table className={cn("w-full caption-bottom border-separate border-spacing-0 text-[13px] leading-snug", className)} {...p} />
  </div>
);
export const TableHeader = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("[&_th]:bg-muted [&_th:first-child]:rounded-l-xl [&_th:last-child]:rounded-r-xl", className)} {...p} />
);
export const TableBody = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={className} {...p} />
);
export const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "[&>td]:transition-colors [&>td]:duration-200 hover:[&>td]:bg-muted/70 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl",
      className,
    )}
    {...p}
  />
);
export const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("h-9 px-2 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap", className)} {...p} />
);
export const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-2 py-2.5 align-middle", className)} {...p} />
);
