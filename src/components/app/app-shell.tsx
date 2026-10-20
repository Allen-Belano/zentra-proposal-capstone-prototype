import { useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity, DatabaseBackup, GitMerge, LayoutDashboard, LogOut, Menu, Monitor, Moon, PanelLeft, Puzzle,
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
  return (
    <nav className="flex flex-col gap-5 px-3">
      {sections.map((sec, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {sec.title && !collapsed && <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{sec.title}</p>}
          {sec.title && collapsed && <div className="mx-2 mb-1 h-px bg-sidebar-border" />}
          {sec.items.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const link = (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "group flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
                  active && "bg-accent font-medium text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className={cn(active && "text-primary")}>{item.icon}</span>
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
        <button className="flex items-center gap-2 rounded-md p-1 pr-2 text-left transition-colors hover:bg-accent">
          <Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium">{me.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="font-medium">{me.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{me.email}</div>
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
        <Button variant="ghost" size="icon" aria-label="Change theme">
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
      "hidden items-center gap-2 rounded-full border px-3 py-1 text-xs md:flex",
      outage ? "border-destructive/40 text-destructive" : "text-muted-foreground",
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", outage ? "bg-destructive" : "bg-success")} />
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
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("zentra-sidebar", c ? "open" : "collapsed"); } catch { /* ignore */ }
      return !c;
    });
  };
  if (!me) return null;

  return (
    <div className="flex h-full">
      <aside className={cn(
        "safe-top sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}>
        <div className={cn("flex h-14 items-center px-5", collapsed && "justify-center px-0")}>
          {collapsed ? <ZentraMark /> : <ZentraLogo />}
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavList collapsed={collapsed} />
        </div>
        <div className={cn("flex items-center gap-2 border-t border-sidebar-border px-5 py-3 text-xs text-muted-foreground", collapsed && "justify-center px-0")}>
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          {!collapsed && <span className="truncate">{me.department} · {ROLE_LABEL[me.role]}</span>}
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="safe-top flex flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main menu</SheetDescription>
          <div className="flex h-14 items-center px-5"><ZentraLogo /></div>
          <div className="flex-1 overflow-y-auto py-3"><NavList onNavigate={() => setMobileOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggle} aria-label="Toggle sidebar">
              <PanelLeft />
            </Button>
            <div className="lg:hidden"><ZentraMark className="h-6 w-6" /></div>
            <div className="ml-auto flex items-center gap-1.5">
              <ConnectionPill />
              <ThemeMenu />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="safe-bottom mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
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
