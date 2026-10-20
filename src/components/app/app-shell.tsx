import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity, Bell, ChevronRight, DatabaseBackup, GitMerge, LayoutDashboard, LogOut, Menu, Monitor, Moon, PanelLeft,
  Puzzle, RefreshCw, RotateCcw, ScrollText, ShieldCheck, Sun, Users, Workflow,
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
import { can, moduleAccess, titleOf, type Permission } from "@/lib/rbac";
import { useTheme } from "@/lib/theme";
import { cn, timeAgo } from "@/lib/utils";
import { isFor, useApp, useMe } from "@/store/app-store";

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

const THEMES = [
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "system", label: "System", icon: <Monitor /> },
] as const;

function UserMenu() {
  const me = useMe()!;
  const logout = useApp((s) => s.logout);
  const resetDemo = useApp((s) => s.resetDemo);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const initials = me.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Account menu" className="rounded-full p-0.5 transition-shadow duration-200 hover:ring-4 hover:ring-primary/10 data-[state=open]:ring-4 data-[state=open]:ring-primary/15">
          <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="font-medium">{me.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{titleOf(me)} · {me.department}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{me.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 pb-1 pt-1.5 text-xs text-muted-foreground">Theme</div>
        <div className="mx-1.5 mb-1 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              aria-pressed={theme === t.value}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors duration-200 [&_svg]:size-3.5",
                theme === t.value ? "bg-card font-medium text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
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

function NotificationBell() {
  const me = useMe()!;
  const all = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markNotificationRead);
  const markAll = useApp((s) => s.markAllNotificationsRead);
  const navigate = useNavigate();
  const mine = all.filter((n) => isFor(n, me)).slice(0, 12);
  const unread = mine.filter((n) => !n.readBy.includes(me.id)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular text-primary-foreground duration-300 animate-in zoom-in-50">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && <button onClick={markAll} className="text-xs text-primary hover:underline">Mark all as read</button>}
        </div>
        {mine.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up</p>
        ) : (
          <div className="max-h-96 overflow-y-auto p-1.5">
            {mine.map((n) => {
              const isNew = !n.readBy.includes(me.id);
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="items-start gap-3 py-2.5"
                  onSelect={() => { markRead(n.id); if (n.orderId) navigate({ to: "/orders/$orderId", params: { orderId: n.orderId } }); }}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isNew ? "bg-primary" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", isNew && "font-medium")}>{n.title}</span>
                    {n.detail && <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>}
                    <span className="block text-xs text-muted-foreground">{timeAgo(n.at)}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Section and page name for the title bar, e.g. "Monitoring › Order tracking". */
function useTitle() {
  const sections = useNav();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const records = useApp((s) => s.records);
  if (path.startsWith("/orders/")) {
    const rec = records.find((r) => r.id === path.split("/")[2]);
    return { section: "Order tracking", page: String(rec?.data.order_no ?? "Order"), back: "/activity" };
  }
  for (const sec of sections) {
    const item = sec.items.find((i) => (i.to === "/" ? path === "/" : path.startsWith(i.to)));
    if (item) return { section: sec.title, page: item.label };
  }
  return { section: undefined, page: "Zentra" };
}

function TitleBar() {
  const { section, page, back } = useTitle();
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {section && (
        <>
          {back ? <Link to={back} className="hidden truncate text-muted-foreground transition-colors hover:text-foreground sm:inline">{section}</Link>
            : <span className="hidden truncate text-muted-foreground sm:inline">{section}</span>}
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:block" />
        </>
      )}
      <span className="truncate font-medium">{page}</span>
    </nav>
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
        <div className={cn("px-3", collapsed && "flex justify-center")}>
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground [&_svg]:size-[18px]",
              collapsed && "w-10 justify-center px-0",
            )}
          >
            <PanelLeft className={cn("transition-transform duration-300 ease-fluid", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </div>
        <div className={cn("m-3 flex items-center gap-2.5 rounded-2xl bg-muted px-3 py-2.5 text-xs text-muted-foreground", collapsed && "justify-center px-0")}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft"><ShieldCheck className="h-3.5 w-3.5" /></span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-medium text-foreground">{titleOf(me)}</span>
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
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:mt-3">
            <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <TitleBar />
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <NotificationBell />
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
