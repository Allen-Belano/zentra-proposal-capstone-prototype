import {
  createHashHistory, createRootRoute, createRoute, createRouter, Link, Outlet, redirect,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app/app-shell";
import { ConfirmHost } from "@/components/app/confirm";
import { Guard } from "@/components/app/guard";
import { ActivityPage } from "@/pages/activity";
import { AuditPage } from "@/pages/audit";
import { BackupsPage } from "@/pages/backups";
import { LoginPage } from "@/pages/login";
import { OrderDetailPage } from "@/pages/order-detail";
import { OverviewPage } from "@/pages/overview";
import { PerformancePage } from "@/pages/performance";
import { PipelinePage } from "@/pages/pipeline";
import { RecordsPage } from "@/pages/records";
import { RegistryPage } from "@/pages/registry";
import { SyncPage } from "@/pages/sync";
import { UsersPage } from "@/pages/users";
import { useApp } from "@/store/app-store";

const signedIn = () => {
  const s = useApp.getState();
  return s.users.some((u) => u.id === s.sessionUserId && u.status === "active");
};

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The link may be outdated, or the page was moved.</p>
      <Button asChild variant="outline"><Link to="/">Back to overview</Link></Button>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton theme="system" />
      <ConfirmHost />
    </TooltipProvider>
  ),
  notFoundComponent: NotFound,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => { if (signedIn()) throw redirect({ to: "/" }); },
  component: LoginPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: () => { if (!signedIn()) throw redirect({ to: "/login" }); },
  component: AppShell,
});

const page = (path: string, component: () => JSX.Element) =>
  createRoute({ getParentRoute: () => appRoute, path, component });

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    page("/", OverviewPage),
    page("/modules/$moduleId", RecordsPage),
    page("/activity", () => <Guard perm="activity.view"><ActivityPage /></Guard>),
    page("/performance", () => <Guard perm="activity.view"><PerformancePage /></Guard>),
    page("/orders/$orderId", () => <Guard perm="activity.view"><OrderDetailPage /></Guard>),
    page("/pipeline", () => <Guard perm="pipeline.manage"><PipelinePage /></Guard>),
    page("/sync", () => <Guard perm="sync.manage"><SyncPage /></Guard>),
    page("/registry", () => <Guard perm="modules.manage"><RegistryPage /></Guard>),
    page("/backups", () => <Guard perm="backups.manage"><BackupsPage /></Guard>),
    page("/users", UsersPage),
    page("/audit", () => <Guard perm="audit.view"><AuditPage /></Guard>),
  ]),
]);

// Hash history keeps deep links working on any static host, including a single-file build.
export const router = createRouter({ routeTree, history: createHashHistory(), defaultNotFoundComponent: NotFound });
