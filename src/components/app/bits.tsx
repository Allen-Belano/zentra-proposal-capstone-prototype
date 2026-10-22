import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, CloudOff, HardDrive, HelpCircle, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { stageVariant, STAGE_INFO, type OrderStage } from "@/lib/orders";
import { canViewFinancials, POSITION_LABEL } from "@/lib/rbac";
import { stageLabel } from "@/lib/terms";
import type { EventLevel, SyncState } from "@/lib/types";
import { cn, formatPeso } from "@/lib/utils";
import { useMe } from "@/store/app-store";

export function PageHeader({ title, description, actions, help }: { title: string; description?: string; actions?: ReactNode; help?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {help && <HelpTip text={help} label={`What "${title}" means`} />}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, hint, tone = "default", icon,
}: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "warning" | "danger" | "success"; icon?: ReactNode }) {
  return (
    <Card className="p-4 transition-shadow duration-300 ease-fluid hover:shadow-float sm:p-5">
      <div className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2 pt-1.5">
          <span className="truncate">{label}</span>
          {/* The explanation lives in a tooltip rather than as small text under every card. */}
          {hint && <HelpTip text={hint} label={`About ${label}`} />}
        </span>
        <span className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted [&_svg]:size-4",
          tone === "warning" && "bg-warning/10 text-warning", tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "success" && "bg-success/10 text-success",
        )}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular sm:text-3xl">{value}</div>
    </Card>
  );
}

const SYNC: Record<SyncState, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default"; icon: ReactNode }> = {
  local: { label: "In Zentra only", variant: "secondary", icon: <HardDrive /> },
  synced: { label: "Sent to Bitrix24", variant: "success", icon: <CheckCircle2 /> },
  pending: { label: "Sending…", variant: "default", icon: <Loader2 className="animate-spin" /> },
  conflict: { label: "Needs review", variant: "warning", icon: <AlertTriangle /> },
  failed: { label: "Couldn't send", variant: "destructive", icon: <CloudOff /> },
};

export function SyncBadge({ state }: { state: SyncState }) {
  const s = SYNC[state];
  return <Badge variant={s.variant}>{s.icon}{s.label}</Badge>;
}

/**
 * A short explanation for a word that stays technical. The icon is a button so
 * keyboard and screen reader users can reach it too; the tooltip opens on hover
 * and on focus, so the explanation is never hover-only.
 */
export function HelpTip({ text, label = "What does this mean?" }: { text: ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2.5 after:content-['']"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs rounded-xl px-3 py-2 leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

export function LevelDot({ level }: { level: EventLevel }) {
  return (
    <span className={cn(
      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
      level === "success" && "bg-success", level === "warning" && "bg-warning",
      level === "error" && "bg-destructive", level === "info" && "bg-info",
    )} />
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-muted"><CircleDashed className="h-5 w-5 text-muted-foreground" /></span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const useCanSeeMoney = () => canViewFinancials(useMe());

/** A peso amount, masked for users without financial access. */
export function Money({ value, className }: { value: number | string | undefined; className?: string }) {
  const allowed = useCanSeeMoney();
  if (allowed) return <span className={cn("tabular", className)}>{formatPeso(Number(value ?? 0))}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex items-center gap-1 text-muted-foreground", className)} aria-label="Restricted amount">
          <Lock className="h-3 w-3" />₱ ••••
        </span>
      </TooltipTrigger>
      <TooltipContent>Only authorized roles can see amounts</TooltipContent>
    </Tooltip>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <Badge variant={stageVariant(stage)}>{stageLabel(stage)}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  return <Badge variant={status === "Paid" ? "success" : "warning"}>{status || "Unpaid"}</Badge>;
}

/** The position responsible for an order's current stage. */
export function ownerOf(stage: string) {
  const owner = STAGE_INFO[stage as OrderStage]?.owner;
  return owner ? POSITION_LABEL[owner] : null;
}
