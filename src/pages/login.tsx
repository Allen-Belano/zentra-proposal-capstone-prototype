import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, Boxes, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZentraLogo, ZentraMark } from "@/components/app/zentra-logo";
import { DEMO_PASSWORD } from "@/data/seed";
import { ROLE_LABEL } from "@/lib/rbac";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app-store";

const DEMO: { email: string; role: Role; name: string; scope: string }[] = [
  { email: "superadmin@ifixz.com", role: "super_admin", name: "Maria Santos", scope: "Accounts, roles, and audit log" },
  { email: "depthead@ifixz.com", role: "dept_head", name: "Carlo Reyes", scope: "Modules, pipeline, sync, and backups" },
  { email: "employee@ifixz.com", role: "employee", name: "Jessa Cruz", scope: "Inventory and order records" },
];

function SourcesDiagram() {
  const sources = [
    { label: "Bitrix24", sub: "Won deals", icon: <ArrowRightLeft className="h-4 w-4" /> },
    { label: "Inventory files", sub: "CSV imports", icon: <Boxes className="h-4 w-4" /> },
    { label: "Transaction system", sub: "Planned", icon: <Building2 className="h-4 w-4" /> },
  ];
  return (
    <div className="relative mt-10 grid grid-cols-[1fr_auto] items-center gap-8">
      <div className="flex flex-col gap-3">
        {sources.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
            <span className="text-sky-300">{s.icon}</span>
            <div>
              <div className="text-sm font-medium text-white">{s.label}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <ZentraMark className="h-14 w-14" />
        <span className="text-xs text-slate-400">One workspace</span>
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
        {[17, 50, 83].map((y) => (
          <path key={y} d={`M 64 ${y} C 74 ${y}, 74 50, 82 50`} stroke="rgb(4 159 217 / 0.55)" strokeWidth="0.5" fill="none" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

export function LoginPage() {
  const login = useApp((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault();
    const creds = override ?? { email, password };
    setBusy(true);
    setError(null);
    setTimeout(() => {
      const r = login(creds.email, creds.password);
      setBusy(false);
      if (!r.ok) return setError(r.error ?? "Sign-in failed.");
      navigate({ to: "/" });
    }, 350);
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b1420] p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5"><ZentraMark /><span className="text-[17px] font-semibold">Zentra</span></div>
        <div className="mt-auto max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Inventory, orders, and every connected system in one validated workspace.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Data from Bitrix24 and file imports passes through the validation pipeline before it reaches the central database.
          </p>
          <SourcesDiagram />
        </div>
        <p className="mt-auto pt-10 text-xs text-slate-500">iFixz Enterprise Co. · Capstone prototype by Aether</p>
      </section>

      <section className="safe-top flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <ZentraLogo className="mb-8 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your iFixz work account.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ifixz.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button>
          </form>

          <div className="mt-8">
            <p className="text-sm font-medium">Demo accounts</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Password for all three: <span className="font-medium text-foreground">{DEMO_PASSWORD}</span></p>
            <div className="mt-3 flex flex-col gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={busy}
                  onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); submit(undefined, { email: d.email, password: DEMO_PASSWORD }); }}
                  className={cn("flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-60")}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{ROLE_LABEL[d.role]}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.name} — {d.scope}</div>
                  </div>
                  <span className="shrink-0 text-xs text-primary">Sign in</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
