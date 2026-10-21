import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ModuleDef } from "@/lib/types";

type Row = Record<string, string | number>;

export function RecordForm({
  open, onOpenChange, module, initial, title, description, submitLabel, onSubmit, initialErrors, hiddenFields = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  module: ModuleDef;
  initial?: Row;
  title: string;
  description?: string;
  submitLabel: string;
  /** Return null when the user cancels the confirmation; the form stays open. */
  onSubmit: (data: Row) => { ok: boolean; errors?: string[] } | null | Promise<{ ok: boolean; errors?: string[] } | null>;
  initialErrors?: string[];
  /** Fields the user isn't allowed to see; they keep their stored values. */
  hiddenFields?: string[];
}) {
  const [values, setValues] = useState<Row>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(module.fields.map((f) => [f.key, initial?.[f.key] ?? ""])));
      setErrors(initialErrors ?? []);
    }
  }, [open, module, initial, initialErrors]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await onSubmit(values);
    if (r && !r.ok) setErrors(r.errors ?? ["Validation failed."]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {errors.length > 0 && (
            <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Didn't pass validation</p>
                <ul className="mt-1 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {module.fields.filter((f) => !hiddenFields.includes(f.key)).map((f) => (
              <div key={f.key} className="grid gap-2">
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                {f.type === "select" && f.options ? (
                  <Select value={String(values[f.key] ?? "")} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}>
                    <SelectTrigger id={`f-${f.key}`}><SelectValue placeholder={`Choose ${f.label.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    type={f.type === "date" ? "date" : "text"}
                    inputMode={f.type === "number" || f.type === "currency" ? "decimal" : undefined}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
