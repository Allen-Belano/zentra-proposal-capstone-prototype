import { Check, Minus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import { can, PERMISSION_MATRIX, ROLE_LABEL, ROLE_SHORT_LABEL } from "@/lib/rbac";
import type { ModuleAccess, Role, User } from "@/lib/types";
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
  const { setUserStatus, setUserRole } = useApp.getState();
  const [q, setQ] = useState("");
  const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Users and roles" description="Enable or disable accounts and assign Department Heads." />
      <Card>
        <div className="border-b p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" />
          </div>
        </div>
        {list.length === 0 ? <EmptyState title="No matching users" /> : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Last active</TableHead>
                <TableHead className="text-right">Can sign in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => {
                const self = u.id === me.id;
                return (
                  <TableRow key={u.id} className={cn(u.status === "disabled" && "opacity-60")}>
                    <TableCell><Person u={u} /></TableCell>
                    <TableCell>
                      {self || u.role === "super_admin" ? <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge> : (
                        <Select value={u.role} onValueChange={(v) => { setUserRole(u.id, v as Role); toast.success(`${u.name} is now a ${ROLE_LABEL[v as Role]}`); }}>
                          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dept_head">Department Head</SelectItem>
                            <SelectItem value="employee">Department Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{u.department}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{timeAgo(u.lastActiveAt)}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        disabled={self}
                        checked={u.status === "active"}
                        onCheckedChange={(v) => { setUserStatus(u.id, v ? "active" : "disabled"); toast.success(v ? `${u.name} can sign in` : `${u.name}'s account is disabled`); }}
                        aria-label={`Allow ${u.name} to sign in`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <PermissionMatrix />
    </>
  );
}

function TeamAccess() {
  const me = useMe()!;
  const users = useApp((s) => s.users);
  const modules = useApp((s) => s.modules.filter((m) => m.active));
  const setModuleAccess = useApp((s) => s.setModuleAccess);
  const team = users.filter((u) => u.role === "employee" && u.department === me.department);
  const accessSelect = (u: User, m: { id: string; name: string }) => (
    <Select
      value={u.moduleAccess[m.id] ?? "none"}
      onValueChange={(v) => { setModuleAccess(u.id, m.id, v as ModuleAccess); toast.success(`${u.name}: ${m.name} access updated`); }}
    >
      <SelectTrigger className="h-8 w-32" aria-label={`${u.name} access to ${m.name}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No access</SelectItem>
        <SelectItem value="view">View</SelectItem>
        <SelectItem value="edit">Edit</SelectItem>
      </SelectContent>
    </Select>
  );
  return (
    <>
      <PageHeader title="Team access" description={`Choose which modules each ${me.department} employee can view or edit. Changes apply right away.`} />
      <Card>
        {team.length === 0 ? <EmptyState title="No employees in your department" /> : (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    {modules.map((m) => <TableHead key={m.id}>{m.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((u) => (
                    <TableRow key={u.id} className={cn(u.status === "disabled" && "opacity-60")}>
                      <TableCell>
                        <Person u={u} />
                        {u.status === "disabled" && <Badge variant="secondary" className="mt-1">Disabled</Badge>}
                      </TableCell>
                      {modules.map((m) => <TableCell key={m.id}>{accessSelect(u, m)}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y sm:hidden">
              {team.map((u) => (
                <li key={u.id} className={cn("p-4", u.status === "disabled" && "opacity-60")}>
                  <Person u={u} />
                  {u.status === "disabled" && <Badge variant="secondary" className="mt-2">Disabled</Badge>}
                  <div className="mt-3 grid gap-2">
                    {modules.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{m.name}</span>
                        {accessSelect(u, m)}
                      </div>
                    ))}
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

export function UsersPage() {
  const me = useMe();
  if (can(me, "users.manage")) return <AdminUsers />;
  if (can(me, "access.manage")) return <TeamAccess />;
  return <Forbidden />;
}
