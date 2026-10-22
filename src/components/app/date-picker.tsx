import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Dates are plain "YYYY-MM-DD" strings, read as calendar days with no time zone.
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UTC = { timeZone: "UTC" } as const;
const SHOW_DAY = new Intl.DateTimeFormat("en-PH", { ...UTC, month: "short", day: "numeric", year: "numeric" });
const SHOW_MONTH = new Intl.DateTimeFormat("en-PH", { ...UTC, month: "long", year: "numeric" });
const HEADING = new Intl.DateTimeFormat("en-PH", { ...UTC, month: "long", year: "numeric" });

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const asDate = (key: string) => new Date(`${key}T00:00:00Z`);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** The trigger every picker shares: it looks like the app's other fields. */
const triggerCls =
  "flex h-10 w-full items-center gap-2 rounded-full border border-transparent bg-muted px-4 text-left text-sm transition-[background-color,border-color,box-shadow] duration-200 hover:border-border focus-visible:border-ring/40 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/15 focus-visible:ring-offset-0 data-[state=open]:border-ring/40 data-[state=open]:bg-card disabled:cursor-not-allowed disabled:opacity-50";

const navCls = "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4";

function Calendar({ value, min, max, onPick }: { value?: string; min?: string; max?: string; onPick: (key: string) => void }) {
  const start = asDate(value || todayKey());
  const [view, setView] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysIn = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const today = todayKey();
  const shift = (by: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + by, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const monthKey = `${view.y}-${pad(view.m + 1)}`;
  return (
    <div className="w-[17.5rem]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navCls} onClick={() => shift(-1)} disabled={!!min && monthKey <= min.slice(0, 7)} aria-label="Previous month"><ChevronLeft /></button>
        <span className="text-sm font-medium">{HEADING.format(first)}</span>
        <button type="button" className={navCls} onClick={() => shift(1)} disabled={!!max && monthKey >= max.slice(0, 7)} aria-label="Next month"><ChevronRight /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => <span key={w} className="pb-1 text-xs font-medium text-muted-foreground">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const key = keyOf(view.y, view.m, d);
          const off = (!!min && key < min) || (!!max && key > max);
          const picked = key === value;
          return (
            <button
              key={key}
              type="button"
              disabled={off}
              onClick={() => onPick(key)}
              aria-pressed={picked}
              aria-label={SHOW_DAY.format(asDate(key))}
              className={cn(
                "mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular transition-colors duration-150",
                picked ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
                !picked && key === today && "ring-1 ring-inset ring-primary/50 text-primary",
                off && "pointer-events-none text-muted-foreground/40",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
      {(!max || today <= max) && (!min || today >= min) && (
        <div className="mt-2 flex justify-end border-t pt-2">
          <button type="button" onClick={() => onPick(today)} className="min-h-9 rounded-full px-3 text-xs font-medium text-primary hover:bg-muted">Today</button>
        </div>
      )}
    </div>
  );
}

/** A date field in Zentra's own style. `value` and `onChange` use "YYYY-MM-DD". */
export function DatePicker({ value, onChange, min, max, id, placeholder = "Choose a date", className, "aria-label": ariaLabel }: {
  value: string; onChange: (key: string) => void; min?: string; max?: string; id?: string; placeholder?: string; className?: string; "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} aria-label={ariaLabel} className={cn(triggerCls, className)}>
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value ? SHOW_DAY.format(asDate(value)) : placeholder}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar value={value} min={min} max={max} onPick={(k) => { onChange(k); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}

/** A month field in Zentra's own style, limited to `months` ("YYYY-MM", newest first). */
export function MonthPicker({ value, months, onChange, className }: {
  value: string; months: string[]; onChange: (month: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))];
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setYear(Number(value.slice(0, 4))); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Month" className={cn(triggerCls, "w-48", className)}>
          <span className="min-w-0 flex-1 truncate">{SHOW_MONTH.format(asDate(`${value}-01`))}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="w-64">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={navCls} onClick={() => setYear((y) => y - 1)} disabled={year <= Math.min(...years)} aria-label="Previous year"><ChevronLeft /></button>
            <span className="text-sm font-medium tabular">{year}</span>
            <button type="button" className={navCls} onClick={() => setYear((y) => y + 1)} disabled={year >= Math.max(...years)} aria-label="Next year"><ChevronRight /></button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, i) => {
              const key = `${year}-${pad(i + 1)}`;
              const off = !months.includes(key);
              const picked = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={off}
                  aria-pressed={picked}
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={cn(
                    "h-10 rounded-full text-sm transition-colors duration-150",
                    picked ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
                    off && "pointer-events-none text-muted-foreground/40",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
