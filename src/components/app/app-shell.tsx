import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity, ChevronDown, DatabaseBackup, GitMerge, LayoutDashboard, LogOut, Menu, Monitor, Moon, PanelLeft, Puzzle,
  RefreshCw, RotateCcw, ScrollText, ShieldCheck, Sun, Users, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ModuleIcon } from "@/components/app/module-icon";
import { ZentraLogo, ZentraMark } from "@/components/app/zentra-logo";
import { can, moduleAccess, ROLE_LABEL, type Permission } from "@/lib/rbac";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

interface NavItem { to: string; label: string; icon: ReactNode; count?: number }

function useNav() {
  const me = useMe();
  const modules = useApp((s) => s.modules);
  const issues = useApp((s) => s.syncOps.filter((o) => o.status === "conflict" || o.status === "failed").length);
  const openRejected = useApp((s) => s.rejected.filter((r) => r.status === "open").length);
  const p = (perm: Permission) => can(me, perm);

  const sections: { title?: string; items: NavItem[] }[] = [
    { items: p("dashboard.view") ? [{ to: "/", label: "Overview", icon: <LayoutDashboard /> }] : [] },
    {
      title: "Modules",
      items: modules
        .filter((m) => m.active && moduleAccess(me, m.id) !== "none")
        .map((m) => ({ to: `/modules/${m.id}`, label: m.name, icon: <ModuleIcon name={m.icon} /> })),
    },
    {
      title: "Monitoring",
      items: [
        ...(p("activity.view") ? [{ to: "/activity", label: "Order tracking", icon: <Activity /> }] : []),
        ...(p("pipeline.manage") ? [{ to: "/pipeline", label: "Data pipeline", icon: <Workflow />, count: openRejected }] : []),
        ...(p("sync.manage") ? [{ to: "/sync", label: "Sync center", icon: <GitMerge />, count: issues }] : []),
      ],
    },
    {
      title: "Administration",
      items: [
        ...(p("modules.manage") ? [{ to: "/registry", label: "Module registry", icon: <Puzzle /> }] : []),
        ...(p("backups.manage") ? [{ to: "/backups", label: "Backups", icon: <DatabaseBackup /> }] : []),
        ...(p("access.manage") ? [{ to: "/users", label: "Team access", icon: <Users /> }] : []),
        ...(p("users.manage") ? [{ to: "/users", label: "Users and roles", icon: <Users /> }] : []),
        ...(p("audit.view") ? [{ to: "/audit", label: "Audit log", icon: <ScrollText /> }] : []),
      ],
    },
  ];
  return sections.filter((s) => s.items.length);
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const sections = useNav();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number; ready: boolean } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>("a[data-active=true]");
      // The first placement doesn't animate; after that the highlight slides between links.
      setPill(active ? (prev) => ({ top: active.offsetTop, height: active.offsetHeight, ready: prev !== null }) : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [path, collapsed, sections.length]);

  return (
    <nav ref={navRef} className="relative flex flex-col gap-5 px-3">
      {pill && (
        <span
          aria-hidden
          className={cn("absolute inset-x-3 top-0 rounded-xl bg-muted", pill.ready && "transition-[transform,height] duration-300 ease-fluid")}
          style={{ height: pill.height, transform: `translateY(${pill.top}px)` }}
        />
      )}
      {sections.map((sec, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {sec.title && !collapsed && <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{sec.title}</p>}
          {sec.title && collapsed && <div className="mx-2 mb-1 h-px bg-sidebar-border" />}
          {sec.items.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const link = (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                data-active={active}
                className={cn(
                  "group relative z-10 flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground [&_svg]:size-[18px] [&_svg]:shrink-0",
                  !active && "hover:bg-muted/50",
                  active && "font-medium text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className={cn("transition-colors duration-200", active && "text-primary")}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && !!item.count && (
                  <span className="ml-auto rounded-full bg-warning/15 px-1.5 text-xs font-medium tabular text-warning">{item.count}</span>
                )}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}{item.count ? ` (${item.count})` : ""}</TooltipContent>
              </Tooltip>
            ) : link;
          })}
        </div>
      ))}
    </nav>
  );
}

function UserMenu() {
  const me = useMe()!;
  const logout = useApp((s) => s.logout);
  const resetDemo = useApp((s) => s.resetDemo);
  const navigate = useNavigate();
  const initials = me.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group flex items-center gap-2.5 rounded-full border border-border/60 bg-card p-1 text-left shadow-soft transition-[background-color,box-shadow] duration-200 hover:shadow-float sm:pr-3 dark:border-border">
          <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium">{me.name}</span>
            <span className="text-xs text-muted-foreground">{me.email}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground transition-transform duration-200 ease-fluid group-data-[state=open]:rotate-180 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="font-medium">{me.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[me.role]} · {me.department}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { resetDemo(); toast.success("Demo data reset"); }}>
          <RotateCcw /> Reset demo data
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { logout(); navigate({ to: "/login" }); }}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change theme">
          {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <Monitor />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("light")}><Sun /> Light</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}><Moon /> Dark</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}><Monitor /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConnectionPill() {
  const me = useMe();
  const outage = useApp((s) => s.outage);
  if (!can(me, "sync.manage")) return null;
  return (
    <Link to="/sync" className={cn(
      "hidden h-9 items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 text-xs shadow-soft transition-colors duration-200 md:flex dark:border-border",
      outage ? "border-destructive/40 text-destructive" : "text-muted-foreground hover:text-foreground",
    )}>
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden", outage ? "bg-destructive" : "bg-success")} />
        <span className={cn("relative h-2 w-2 rounded-full", outage ? "bg-destructive" : "bg-success")} />
      </span>
      {outage ? "Bitrix24 unreachable" : "Bitrix24 connected"}
    </Link>
  );
}

export function AppShell() {
  const me = useMe();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("zentra-sidebar") === "collapsed"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Each page starts at the top, so its entrance animation is visible.
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [path]);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("zentra-sidebar", c ? "open" : "collapsed"); } catch { /* ignore */ }
      return !c;
    });
  };
  if (!me) return null;

  return (
    <div className="flex min-h-full">
      {/* min-h-full (not h-full) lets the page grow past the viewport, so the sidebar stays put while scrolling. */}
      <aside className={cn(
        "safe-top sticky top-3 my-3 ml-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 self-start flex-col overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar shadow-soft transition-[width] duration-300 ease-fluid lg:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}>
        <div className={cn("flex h-16 items-center px-6", collapsed && "justify-center px-0")}>
          {collapsed ? <ZentraMark /> : <ZentraLogo />}
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavList collapsed={collapsed} />
        </div>
        <div className={cn("m-3 flex items-center gap-2.5 rounded-2xl bg-muted px-3 py-2.5 text-xs text-muted-foreground", collapsed && "justify-center px-0")}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft"><ShieldCheck className="h-3.5 w-3.5" /></span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-medium text-foreground">{ROLE_LABEL[me.role]}</span>
              <span className="block truncate">{me.department}</span>
            </span>
          )}
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="safe-top flex flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main menu</SheetDescription>
          <div className="flex h-16 items-center px-6"><ZentraLogo /></div>
          <div className="flex-1 overflow-y-auto py-3"><NavList onNavigate={() => setMobileOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-30 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:mt-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggle} aria-label="Toggle sidebar">
              <PanelLeft />
            </Button>
            <div className="lg:hidden"><ZentraMark className="h-6 w-6" /></div>
            <div className="ml-auto flex items-center gap-2">
              <ConnectionPill />
              <ThemeMenu />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="safe-bottom mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4 sm:px-6 lg:pt-6">
          <div key={path} className="duration-500 ease-fluid animate-in fade-in-0 slide-in-from-bottom-2">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function useSyncNowToast() {
  const syncNow = useApp((s) => s.syncNow);
  return (moduleId: string) => {
    const r = syncNow(moduleId);
    if (r.failed) toast.error("Bitrix24 is unreachable", { description: "Showing the last synced data. Try again when the connection is back." });
    else if (!r.pulled && !r.updated && !r.rejected) toast("Already up to date", { icon: <RefreshCw className="h-4 w-4" /> });
    else toast.success("Sync complete", {
      description: [r.pulled && `${r.pulled} new`, r.updated && `${r.updated} updated`, r.rejected && `${r.rejected} rejected`].filter(Boolean).join(", "),
    });
  };
}
