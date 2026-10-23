import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/bits";
import { RegisterModuleWizard, MAX_ADDITIONAL } from "@/components/app/register-wizard";
import { useApp } from "@/store/app-store";

/**
 * Connecting a system is a long task with several steps, so it gets its own
 * page rather than a dialog. The page can be linked to, bookmarked, and
 * returned to.
 */
export function RegisterModulePage() {
  const modules = useApp((s) => s.modules);
  const navigate = useNavigate();
  const additional = modules.filter((m) => !m.baseline).length;

  return (
    <>
      <Link
        to="/registry"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Integration Hub
      </Link>
      <PageHeader
        title="Connect a system"
        description="Add a system that records are typed into directly, or connect one that is already running somewhere else. It appears in the sidebar with its own page and its own rules for checking records."
      />
      <RegisterModuleWizard atLimit={additional >= MAX_ADDITIONAL} onDone={() => navigate({ to: "/registry" })} />
    </>
  );
}
