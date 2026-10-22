import { create } from "zustand";
import { AlertTriangle, Loader2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  /** What is about to happen, e.g. "Archive DSP-1001?" */
  title: string;
  /** The effect of confirming, in plain words. */
  description: string;
  /** Optional facts shown as a short list, e.g. the record and the new value. */
  details?: [label: string, value: string][];
  confirmLabel?: string;
  /** Red styling for removals and other actions that are hard to undo. */
  destructive?: boolean;
  /**
   * Runs after the user confirms. While it is running the dialog stays open and
   * the confirm button shows a spinner, so the user can see the work happening.
   */
  onConfirm?: () => void | Promise<void>;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  open: boolean;
  busy: boolean;
}

const useConfirmStore = create<ConfirmState>(() => ({ request: null, open: false, busy: false }));

/**
 * Ask the user to confirm a change before it runs. Resolves true only when they confirm;
 * closing the dialog or pressing Cancel resolves false. When the options carry an
 * `onConfirm`, that runs while the dialog is still open, and the dialog closes once it
 * finishes.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const pending = useConfirmStore.getState().request;
  pending?.resolve(false);
  return new Promise((resolve) => useConfirmStore.setState({ request: { ...options, resolve }, open: true, busy: false }));
}

/** Runs `action` only after the user confirms. */
export async function withConfirm(options: ConfirmOptions, action: () => void) {
  if (await confirmAction(options)) action();
}

function settle(ok: boolean) {
  const { request } = useConfirmStore.getState();
  // Keep the request while the dialog animates out, so its text doesn't vanish mid-fade.
  useConfirmStore.setState({ open: false, busy: false });
  request?.resolve(ok);
}

/** Mounted once at the app root. */
export function ConfirmHost() {
  const { request, open, busy } = useConfirmStore();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) settle(false); }}>
      <DialogContent className="sm:max-w-md">
        {request && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <span className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  request.destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                )}>
                  {request.destructive ? <AlertTriangle className="h-5 w-5" /> : <ShieldQuestion className="h-5 w-5" />}
                </span>
                <div className="grid gap-1.5 pt-1">
                  <DialogTitle>{request.title}</DialogTitle>
                  <DialogDescription>{request.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            {request.details && request.details.length > 0 && (
              <dl className="grid gap-1.5 rounded-2xl bg-muted px-4 py-3 text-sm">
                {request.details.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => settle(false)} disabled={busy}>Cancel</Button>
              <Button
                variant={request.destructive ? "destructive" : "default"}
                disabled={busy}
                onClick={async () => {
                  if (!request.onConfirm) return settle(true);
                  useConfirmStore.setState({ busy: true });
                  try {
                    await request.onConfirm();
                    settle(true);
                  } catch {
                    settle(false);
                  }
                }}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {request.confirmLabel ?? "Save"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
