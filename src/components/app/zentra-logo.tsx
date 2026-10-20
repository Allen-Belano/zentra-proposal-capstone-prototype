import { cn } from "@/lib/utils";

export function ZentraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 10h12L10 22h12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ZentraLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <ZentraMark />
      <span className="text-[17px] font-semibold tracking-tight">Zentra</span>
    </div>
  );
}
