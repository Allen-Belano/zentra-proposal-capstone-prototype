import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, ROLE_LABEL, type Permission } from "@/lib/rbac";
import { useMe } from "@/store/app-store";

export function Forbidden({ message }: { message?: string }) {
  const me = useMe();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="rounded-full bg-muted p-3"><Lock className="h-5 w-5 text-muted-foreground" /></div>
      <h1 className="text-xl font-semibold">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {message ?? `Your role (${me ? ROLE_LABEL[me.role] : "guest"}) can't open this page. Ask your Department Head or Super Admin if you need access.`}
      </p>
      <Button asChild variant="outline" className="mt-2"><Link to="/">Back to overview</Link></Button>
    </div>
  );
}

export function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const me = useMe();
  return can(me, perm) ? <>{children}</> : <Forbidden />;
}
