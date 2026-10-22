import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, jobTitleOf, type Permission } from "@/lib/rbac";
import { useMe } from "@/store/app-store";

export function Forbidden({ message }: { message?: string }) {
  const me = useMe();
  const role = me ? jobTitleOf(me) : "guest";
  // Point at someone who can actually grant access.
  const ask = me?.role === "super_admin"
    ? "Ask another administrator if you need access."
    : me?.role === "dept_head"
      ? "Ask a Super Admin if you need access."
      : "Ask your Department Head or Super Admin if you need access.";
  const fallback = `Your role (${role}) can't open this page. ${ask}`;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="rounded-full bg-muted p-3"><Lock className="h-5 w-5 text-muted-foreground" /></div>
      <h1 className="text-xl font-semibold">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{message ?? fallback}</p>
      <Button asChild variant="outline" className="mt-2"><Link to="/">Back to {me ? jobTitleOf(me) : "the start"}</Link></Button>
    </div>
  );
}

export function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const me = useMe();
  return can(me, perm) ? <>{children}</> : <Forbidden />;
}
