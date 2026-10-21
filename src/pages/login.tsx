import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, Boxes, Building2, ChevronDown, ChevronRight, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZentraMark } from "@/components/app/zentra-logo";
import ifixzLogo from "@/assets/ifixz-logo.png";
import { DEMO_PASSWORD, STAFF } from "@/data/seed";
import { POSITION_LABEL, POSITIONS } from "@/lib/rbac";
import type { Position } from "@/lib/types";

const POSITION_SCOPE: Record<Position, string> = {
  accounting: "Credit checks and payments",
  purchasing: "Supplier POs",
  inventory: "Stock and receiving reports",
  invoicing: "Sales invoices and WRs",
  delivery: "Deliveries and DRs",
};
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app-store";

const DEMO: { email: string; title: string; name: string; scope: string }[] = [
  { email: "superadmin@ifixz.com", title: "Super Admin", name: "Maria Santos", scope: "Accounts, roles, and audit log" },
  { email: "depthead@ifixz.com", title: "Department Head", name: "Carlo Reyes", scope: "Business overview, sync, and team roles" },
  ...POSITIONS.map((p) => ({ email: STAFF[p].email, title: POSITION_LABEL[p], name: STAFF[p].name, scope: POSITION_SCOPE[p] })),
];

/** Sun/moon switch. Flips between light and dark from whatever is showing now. */
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [theme]);
  return (
    <button
      type="button" role="switch" aria-checked={dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="relative inline-flex h-9 w-[68px] items-center rounded-full border border-border/60 bg-card p-1 shadow-soft transition-colors duration-300 hover:bg-muted dark:border-border"
    >
      <span className={cn(
        "absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform duration-500 ease-fluid",
        dark && "translate-x-[30px]",
      )}>
        {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <Sun className={cn("ml-1.5 h-3.5 w-3.5 transition-opacity duration-300", dark ? "opacity-50" : "opacity-0")} aria-hidden />
      <Moon className={cn("ml-auto mr-1.5 h-3.5 w-3.5 transition-opacity duration-300", dark ? "opacity-0" : "opacity-50")} aria-hidden />
    </button>
  );
}

/** The iFixz logo is white; on light surfaces it's tinted dark so it stays visible. */
function IfixzLogo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <img
      src={ifixzLogo} alt="iFixz Enterprise Co." draggable={false}
      className={cn("h-auto select-none", !onDark && "brightness-0 opacity-80 dark:opacity-100 dark:brightness-100", className)}
    />
  );
}

const GLOW = "#5ee7ff";
const CORE = "#e6fbff";

/**
 * Sources flowing into Zentra. Glowing beams run along all three lines; hovering a source
 * lights its line, clicking it sends a burst that ripples the logo, and hovering the logo
 * lights every line. Paths are measured from the real card and logo positions.
 */
function SourcesDiagram() {
  const sources = [
    { label: "Bitrix24", sub: "Won deals", icon: <ArrowRightLeft className="h-4 w-4" /> },
    { label: "Inventory files", sub: "CSV imports", icon: <Boxes className="h-4 w-4" /> },
    { label: "Transaction system", sub: "Planned", icon: <Building2 className="h-4 w-4" /> },
  ];
  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const logo = useRef<HTMLDivElement>(null);
  const filterId = `glow-${useId().replace(/:/g, "")}`;
  const [geo, setGeo] = useState<{ w: number; h: number; paths: string[]; cx: number; cy: number } | null>(null);
  const [hot, setHot] = useState<number[]>([]);
  const [bursts, setBursts] = useState<{ id: number; i: number; delay: number }[]>([]);
  const [ripples, setRipples] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const l = logo.current!.getBoundingClientRect();
      const ex = l.left - box.left - 2;
      const ey = l.top - box.top + l.height / 2;
      const paths = cards.current.map((c) => {
        const r = c!.getBoundingClientRect();
        const sx = r.right - box.left - 2;
        const sy = r.top - box.top + r.height / 2;
        const mx = (sx + ex) / 2;
        return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
      });
      setGeo({ w: box.width, h: box.height, paths, cx: l.left - box.left + l.width / 2, cy: ey });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const fire = (lines: number[]) => {
    const now = Date.now();
    const added = lines.flatMap((i) => [0, 1, 2, 3].map((k) => ({ id: now + i * 10 + k, i, delay: k * 90 })));
    setBursts((b) => [...b, ...added]);
    later(() => setRipples((r) => [...r, now]), 650);
    later(() => setBursts((b) => b.filter((x) => !added.includes(x))), 1100);
    later(() => setRipples((r) => r.filter((x) => x !== now)), 1500);
  };
  const isHot = (i: number) => hot.includes(i);

  return (
    <div ref={wrap} className="relative mt-10 grid max-w-2xl grid-cols-[minmax(0,15rem)_minmax(5rem,1fr)_auto] items-center">
      {geo && (
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden>
          <defs>
            {/* User-space bounds, so the straight middle line (zero height) still gets its glow. */}
            <filter id={filterId} filterUnits="userSpaceOnUse" x={-20} y={-20} width={geo.w + 40} height={geo.h + 40}>
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {geo.paths.map((d, i) => (
            <g key={i} filter={`url(#${filterId})`}>
              <path d={d} fill="none" stroke={GLOW} strokeWidth={isHot(i) ? 2.2 : 1.4} strokeOpacity={isHot(i) ? 0.9 : 0.35}
                style={{ transition: "stroke-opacity .3s, stroke-width .3s" }} />
              <path d={d} pathLength={100} fill="none" stroke={CORE} strokeWidth={3} strokeLinecap="round" strokeDasharray="26 100"
                style={{ animation: `zentra-beam ${isHot(i) ? 0.8 : 2.2}s linear ${-(i * 0.73)}s infinite` }} />
            </g>
          ))}
          <g filter={`url(#${filterId})`}>
            {[0, 1.1].map((delay) => (
              <circle key={delay} cx={geo.cx} cy={geo.cy} r={30} fill="none" stroke={GLOW} strokeWidth={1.5}
                style={{ transformBox: "fill-box", transformOrigin: "center", animation: `zentra-ripple 2.2s ease-out ${delay}s infinite` }} />
            ))}
            {ripples.map((id) => (
              <circle key={id} cx={geo.cx} cy={geo.cy} r={30} fill="none" stroke={CORE} strokeWidth={3}
                style={{ transformBox: "fill-box", transformOrigin: "center", animation: "zentra-ripple .8s ease-out forwards" }} />
            ))}
          </g>
        </svg>
      )}
      {geo && bursts.map((b) => (
        <span key={b.id} aria-hidden className="pointer-events-none absolute left-0 top-0 h-2 w-2 rounded-full"
          style={{
            background: CORE, boxShadow: `0 0 10px 3px ${GLOW}`, offsetPath: `path("${geo.paths[b.i]}")`,
            animation: `zentra-burst .7s ease-in ${b.delay}ms both`,
          }} />
      ))}
      <div className="relative z-10 flex flex-col gap-3">
        {sources.map((s, i) => (
          <div
            key={s.label}
            ref={(el) => { cards.current[i] = el; }}
            role="button" tabIndex={0}
            aria-label={`Send a sample sync from ${s.label}`}
            onMouseEnter={() => setHot([i])} onMouseLeave={() => setHot([])}
            onFocus={() => setHot([i])} onBlur={() => setHot([])}
            onClick={() => fire([i])}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire([i]); } }}
            className={cn(
              "flex cursor-pointer select-none items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-fluid active:scale-[0.98]",
              isHot(i) ? "border-cyan-300/50 bg-white/[0.09] shadow-[0_0_24px_-4px_rgba(94,231,255,0.45)]" : "border-white/10 bg-white/[0.05]",
            )}
          >
            <span className={cn("transition-colors duration-300", isHot(i) ? "text-cyan-200" : "text-sky-300")}>{s.icon}</span>
            <div>
              <div className="text-sm font-medium text-white">{s.label}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div
          ref={logo}
          role="button" tabIndex={0} aria-label="Send a sample sync from every source"
          onMouseEnter={() => setHot([0, 1, 2])} onMouseLeave={() => setHot([])}
          onFocus={() => setHot([0, 1, 2])} onBlur={() => setHot([])}
          onClick={() => fire([0, 1, 2])}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire([0, 1, 2]); } }}
          className={cn(
            "cursor-pointer rounded-[14px] transition-[transform,box-shadow] duration-300 ease-fluid hover:scale-105 active:scale-95",
            hot.length === 3 ? "shadow-[0_0_36px_4px_rgba(94,231,255,0.55)]" : "shadow-[0_0_24px_0_rgba(94,231,255,0.3)]",
          )}
        >
          <ZentraMark className="h-14 w-14" />
        </div>
        <span className="text-xs text-slate-400">One workspace</span>
      </div>
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
  const [showDemo, setShowDemo] = useState(false);

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
      <section className="relative m-3 hidden overflow-hidden rounded-3xl bg-gradient-to-br from-[#16303f] via-[#122634] to-[#0b1822] p-12 text-white shadow-float duration-700 [&_rect.fill-primary]:fill-[hsl(192_50%_42%)] ease-fluid animate-in fade-in-0 slide-in-from-left-4 lg:flex lg:flex-col">
        <IfixzLogo onDark className="w-40 drop-shadow-[0_0_18px_rgba(94,231,255,0.25)] xl:w-44" />
        <div className="mt-auto">
          <div className="max-w-md">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Inventory, orders, and every connected system in one validated workspace.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Data from Bitrix24 and file imports passes through the validation pipeline before it reaches the central database.
            </p>
          </div>
          <SourcesDiagram />
        </div>
        <p className="mt-auto pt-10 text-xs text-slate-500">iFixz Workspace · Powered by Zentra</p>
      </section>

      <section className="relative flex min-w-0 flex-col items-center px-5 pb-16 pt-[max(5rem,env(safe-area-inset-top))] sm:px-10">
        <div className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] sm:right-8 sm:top-8"><ThemeSwitch /></div>
        {/* my-auto centers vertically without pushing the top off-screen when the content is taller. */}
        <div className="my-auto w-full max-w-md duration-700 ease-fluid animate-in fade-in-0 slide-in-from-bottom-3">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <IfixzLogo className="w-28" />
            <span className="border-l border-border pl-3 text-xs text-muted-foreground">Workspace<br />Powered by Zentra</span>
          </div>
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

          <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 dark:border-border">
            <button
              type="button" onClick={() => setShowDemo((o) => !o)}
              aria-expanded={showDemo} aria-controls="demo-accounts"
              className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/60"
            >
              <span>
                <span className="block text-sm font-medium">Demo accounts</span>
                <span className="block text-xs text-muted-foreground">{showDemo ? "Pick an account to sign in" : `${DEMO.length} accounts · one-click sign-in`}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-fluid", showDemo && "rotate-180")} />
            </button>
            {/* Grid rows 0fr → 1fr animates to the content's natural height. */}
            <div
              id="demo-accounts"
              className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-fluid", showDemo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
            >
              <div className="overflow-hidden" aria-hidden={!showDemo}>
                <div className="px-3 pb-3">
                  <p className="px-1 pb-2 text-xs text-muted-foreground">Password for all accounts: <span className="font-medium text-foreground">{DEMO_PASSWORD}</span></p>
                  <div key={showDemo ? "open" : "closed"} className={cn("grid gap-2 sm:grid-cols-2", showDemo && "stagger")}>
                    {DEMO.map((d) => (
                      <button
                        key={d.email}
                        type="button"
                        disabled={busy}
                        tabIndex={showDemo ? 0 : -1}
                        onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); submit(undefined, { email: d.email, password: DEMO_PASSWORD }); }}
                        className={cn("flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left shadow-soft transition-[border-color,box-shadow,transform] duration-200 ease-fluid hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-float active:translate-y-0 disabled:opacity-60 dark:border-border")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{d.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{d.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{d.scope}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
