import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });

// Chrome and Edge show a calendar for month inputs; Firefox and desktop Safari show a plain text box instead.
const nativeMonth = (() => {
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  return input.type === "month";
})();

/**
 * Picks a month ("YYYY-MM") from `months`, newest first. Uses the browser's calendar, the same one as the
 * date fields, and falls back to a list where the browser has no month calendar.
 */
export function MonthPicker({ value, months, onChange, className }: {
  value: string; months: string[]; onChange: (month: string) => void; className?: string;
}) {
  if (nativeMonth) {
    return (
      <Input
        type="month"
        value={value}
        min={months.at(-1)}
        max={months[0]}
        onChange={(e) => months.includes(e.target.value) && onChange(e.target.value)}
        className={cn("h-10 w-44", className)}
        aria-label="Month"
      />
    );
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-10 w-44", className)} aria-label="Month"><SelectValue /></SelectTrigger>
      <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{MONTH.format(new Date(`${m}-01T00:00:00Z`))}</SelectItem>)}</SelectContent>
    </Select>
  );
}
