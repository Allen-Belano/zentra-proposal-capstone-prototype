import { Check, Minus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/app/confirm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import {
  can, canViewFinancials, financialByPosition, moduleAccess, PERMISSION_MATRIX, POSITION_LABEL, POSITION_MATRIX, POSITIONS,
  ROLE_LABEL, ROLE_SHORT_LABEL,
} from "@/lib/rbac";
import type { ModuleAccess, Position, Role, User } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);

function Person({ u }: { u: User }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar><AvatarFallback>{initials(u.name)}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium">{u.name}</div>
        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
      </div>
    </div>
  );
}

function PermissionMatrix() {
  const roles: Role[] = ["super_admin", "dept_head", "employee"];
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>What each role can do</CardTitle>
        <CardDescription>Permissions are enforced on every page and action.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Permission</TableHead>
              {roles.map((r) => (
                <TableHead key={r} className="px-1.5 text-center sm:px-3">
                  <span className="sm:hidden">{ROLE_SHORT_LABEL[r]}</span><span className="hidden sm:inline">{ROLE_LABEL[r]}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_MATRIX.map((p) => (
              <TableRow key={p.label}>
                <TableCell className="pl-5">{p.label}</TableCell>
                {roles.map((r) => (
                  <TableCell key={r} className="px-1.5 text-center sm:px-3">
                    {p.roles[r] ? <Check className="mx-auto h-4 w-4 text-success" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not allowed" />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminUsers() {
  const me = useMe()!;
  const users = useApp((s) => s.users);
  const { setUserStatus, setUserRole, setFinancialAccess } = useApp.getState();
  const [q, setQ] = useState("");
  const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const roleControl = (u: User) => u.id === me.id || u.role === "super_admin" ? <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge> : (
    <Select value={u.role} onValueChange={async (v) => {
      if (!(await confirmAction({ title: `Change ${u.name}'s role?`, description: "Their pages and permissions change as soon as you confirm.", details: [["From", ROLE_LABEL[u.role]], ["To", ROLE_LABEL[v as Role]]], confirmLabel: "Change role" }))) return;
      setUserRole(u.id, v as Role); toast.success(`${u.name} is now a ${ROLE_LABEL[v as Role]}`); }}>
      <SelectTrigger className="h-10 w-56" aria-label={`${u.name}'s role`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="dept_head">{ROLE_LABEL.dept_head}</SelectItem>
        <SelectItem value="employee">Department Employee</SelectItem>
      </SelectContent>
    </Select>
  );
  const signInSwitch = (u: User) => (
    <Switch
      disabled={u.id === me.id}
      checked={u.status === "active"}
      onCheckedChange={async (v) => {
        if (!(await confirmAction(v
          ? { title: `Let ${u.name} sign in?`, description: "Their account is enabled and they can sign in again.", confirmLabel: "Enable account" }
          : { title: `Disable ${u.name}'s account?`, description: "They're signed out of new sessions and can't sign in until you enable the account again.", confirmLabel: "Disable account", destructive: true }))) return;
        setUserStatus(u.id, v ? "active" : "disabled"); toast.success(v ? `${u.name} can sign in` : `${u.name}'s account is disabled`); }}
      aria-label={`Allow ${u.name} to sign in`}
    />
  );
  const moneyControl = (u: User) => {
    if (u.role !== "employee") return <Badge variant="secondary">Full access</Badge>;
    if (financialByPosition(u)) return <Badge variant="secondary">By role</Badge>;
    return (
      <Switch
        checked={!!u.financialAccess}
        onCheckedChange={(v) => {
          const r = setFinancialAccess(u.id, v);
          if (!r.ok) return toast.error(r.errors?.[0] ?? "Couldn't change this access");
          toast.success(v ? `${u.name} can now see amounts` : `${u.name} can no longer see amounts`, {
            action: { label: "Undo", onClick: () => setFinancialAccess(u.id, !v) },
          });
        }}
        aria-label={`Let ${u.name} see financial data`}
      />
    );
  };
  const position = (u: User) => (u.role === "employee" ? (u.position ? POSITION_LABEL[u.position] : "Unassigned") : "—");
  return (
    <>
      <PageHeader title="Users and roles" description="Enable or disable accounts, assign Operations Department Heads, and grant access to financial data." />
      <Card>
        <div className="border-b p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" />
          </div>
        </div>
        {list.length === 0 ? <EmptyState title="No matching users" /> : (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Operations role</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Last active</TableHead>
                    <TableHead>Financial data</TableHead>
                    <TableHead className="text-right">Can sign in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((u) => (
                    <TableRow key={u.id} className={cn(u.status === "disabled" && "opacity-60")}>
                      <TableCell><Person u={u} /></TableCell>
                      <TableCell>{roleControl(u)}</TableCell>
                      <TableCell className="hidden md:table-cell">{position(u)}</TableCell>
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">{timeAgo(u.lastActiveAt)}</TableCell>
                      <TableCell>{moneyControl(u)}</TableCell>
                      <TableCell className="text-right">{signInSwitch(u)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y sm:hidden">
              {list.map((u) => (
                <li key={u.id} className={cn("grid gap-3 p-4", u.status === "disabled" && "opacity-60")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><Person u={u} /></div>
                    {signInSwitch(u)}
                  </div>
                  <div>{roleControl(u)}</div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{position(u)} · financial data</span>
                    {moneyControl(u)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <PermissionMatrix />
    </>
  );
}

function PositionMatrix() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>What each Operations role can do</CardTitle>
        <CardDescription>The assigned role decides an employee's modules, data, and actions. Salaries and other financial records stay restricted.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Five role columns don't fit a phone, so phones list the allowed roles under each permission. */}
        <ul className="divide-y px-5 pb-4 sm:hidden">
          {POSITION_MATRIX.map((row) => (
            <li key={row.label} className="py-3">
              <p className="text-sm">{row.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.positions.map((p) => <span key={p} className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">{POSITION_LABEL[p]}</span>)}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Permission</TableHead>
              {POSITIONS.map((p) => <TableHead key={p} className="px-1.5 text-center sm:px-3">{POSITION_LABEL[p]}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {POSITION_MATRIX.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="pl-5">{row.label}</TableCell>
                {POSITIONS.map((p) => (
                  <TableCell key={p} className="px-1.5 text-center sm:px-3">
                    {row.positions.includes(p) ? <Check className="mx-auto h-4 w-4 text-success" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not allowed" />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamAccess() {
  const me = useMe()!;
  const users = useApp((s) => s.users);
  // Baseline modules follow the role; only modules registered later need a per-person grant.
  const extraModules = useApp((s) => s.modules.filter((m) => m.active && !m.baseline));
  const { setModuleAccess, setUserPosition, setTeamKpiAccess } = useApp.getState();
  const kpiSwitch = (u: User) => (
    <Switch
      checked={!!u.teamKpiAccess}
      onCheckedChange={(v) => {
        const r = setTeamKpiAccess(u.id, v);
        if (!r.ok) return toast.error(r.errors?.[0] ?? "Couldn't change this access");
        toast.success(v ? `${u.name} can now see the team's key numbers` : `${u.name} now sees only their own numbers`, {
          action: { label: "Undo", onClick: () => setTeamKpiAccess(u.id, !v) },
        });
      }}
      aria-label={`Let ${u.name} see the team's key numbers`}
    />
  );
  const team = users.filter((u) => u.role === "employee" && u.department === me.department);

  const positionSelect = (u: User) => (
    <Select
      value={u.position ?? ""}
      onValueChange={async (v) => {
        if (!(await confirmAction({
          title: `Move ${u.name} to ${POSITION_LABEL[v as Position]}?`,
          description: "Their pages, order stages, and access to amounts follow the new role right away.",
          details: [["From", u.position ? POSITION_LABEL[u.position] : "Unassigned"], ["To", POSITION_LABEL[v as Position]]],
          confirmLabel: "Change role",
        }))) return;
        const r = setUserPosition(u.id, v as Position);
        if (r.ok) toast.success(`${u.name} is now in ${POSITION_LABEL[v as Position]}`);
        else toast.error(r.errors?.[0] ?? "Couldn't change the role");
      }}
    >
      <SelectTrigger className="h-10 w-40" aria-label={`${u.name}'s Operations role`}><SelectValue placeholder="Choose a role" /></SelectTrigger>
      <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}</SelectContent>
    </Select>
  );
  const accessSelect = (u: User, m: { id: string; name: string }) => (
    <Select value={u.moduleAccess[m.id] ?? "none"} onValueChange={async (v) => {
      if (!(await confirmAction({ title: `Change ${u.name}'s access to ${m.name}?`, description: "The change applies right away.", details: [["From", u.moduleAccess[m.id] ?? "none"], ["To", v]], confirmLabel: "Change access" }))) return;
      setModuleAccess(u.id, m.id, v as ModuleAccess); toast.success(`${u.name}: ${m.name} access updated`); }}>
      <SelectTrigger className="h-10 w-32" aria-label={`${u.name} access to ${m.name}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No access</SelectItem>
        <SelectItem value="view">View</SelectItem>
        <SelectItem value="edit">Edit</SelectItem>
      </SelectContent>
    </Select>
  );
  const yesNo = (on: boolean, label: string) => (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", on ? "text-success" : "text-muted-foreground")}>
      {on ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{label}
    </span>
  );

  return (
    <>
      <PageHeader title="Team access" description={`Assign each ${me.department} employee one Operations role. The role decides which modules, data, and actions they can use.`} />
      <Card>
        {team.length === 0 ? <EmptyState title="No employees in your department" /> : (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    <TableHead>Role / position</TableHead>
                    <TableHead className="hidden lg:table-cell">Inventory</TableHead>
                    <TableHead className="hidden lg:table-cell">Amounts and costs</TableHead>
                    <TableHead>Team performance</TableHead>
                    {extraModules.map((m) => <TableHead key={m.id}>{m.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((u) => (
                    <TableRow key={u.id} className={cn(u.status === "disabled" && "opacity-60")}>
                      <TableCell>
                        <Person u={u} />
                        {u.status === "disabled" && <Badge variant="secondary" className="mt-1">Disabled</Badge>}
                      </TableCell>
                      <TableCell>{positionSelect(u)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{yesNo(moduleAccess(u, "ims") === "edit", moduleAccess(u, "ims") === "edit" ? "Can edit" : "View only")}</TableCell>
                      <TableCell className="hidden lg:table-cell">{yesNo(canViewFinancials(u), canViewFinancials(u) ? "Visible" : "Hidden")}</TableCell>
                      <TableCell>{kpiSwitch(u)}</TableCell>
                      {extraModules.map((m) => <TableCell key={m.id}>{accessSelect(u, m)}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y sm:hidden">
              {team.map((u) => (
                <li key={u.id} className={cn("grid gap-3 p-4", u.status === "disabled" && "opacity-60")}>
                  <Person u={u} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Role</span>
                    {positionSelect(u)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {yesNo(moduleAccess(u, "ims") === "edit", moduleAccess(u, "ims") === "edit" ? "Edits inventory" : "Views inventory")}
                    {yesNo(canViewFinancials(u), canViewFinancials(u) ? "Sees amounts" : "Amounts hidden")}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Team performance</span>
                    {kpiSwitch(u)}
                  </div>
                  {extraModules.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{m.name}</span>
                      {accessSelect(u, m)}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <PositionMatrix />
      <PermissionMatrix />
    </>
  );
}

export function UsersPage() {
  const me = useMe();
  if (can(me, "users.manage")) return <AdminUsers />;
  if (can(me, "access.manage")) return <TeamAccess />;
  return <Forbidden />;
}
