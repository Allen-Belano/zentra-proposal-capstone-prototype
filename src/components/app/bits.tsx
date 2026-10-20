import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, CloudOff, HardDrive, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EventLevel, SyncState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
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
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className={cn(
          "[&_svg]:size-4",
          tone === "warning" && "text-warning", tone === "danger" && "text-destructive", tone === "success" && "text-success",
        )}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

const SYNC: Record<SyncState, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default"; icon: ReactNode }> = {
  local: { label: "Saved", variant: "secondary", icon: <HardDrive /> },
  synced: { label: "Synced", variant: "success", icon: <CheckCircle2 /> },
  pending: { label: "Syncing", variant: "default", icon: <Loader2 className="animate-spin" /> },
  conflict: { label: "Conflict", variant: "warning", icon: <AlertTriangle /> },
  failed: { label: "Failed", variant: "destructive", icon: <CloudOff /> },
};

export function SyncBadge({ state }: { state: SyncState }) {
  const s = SYNC[state];
  return <Badge variant={s.variant}>{s.icon}{s.label}</Badge>;
}

export function LevelDot({ level }: { level: EventLevel }) {
  return (
    <span className={cn(
      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
      level === "success" && "bg-success", level === "warning" && "bg-warning",
      level === "error" && "bg-destructive", level === "info" && "bg-primary",
    )} />
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <CircleDashed className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
