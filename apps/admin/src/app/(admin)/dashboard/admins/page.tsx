"use client";

import { useState } from "react";
import {
  useAdminAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useRemoveAdmin,
  type PlatformAdminRow,
} from "@/hooks/use-admin-admins";
import { ROLE_LABELS, useAdminSession, type PlatformAdminRole } from "@/components/admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ShieldCheck } from "lucide-react";
import { ADMIN_EMAIL_DOMAIN, isValidAlias, toAdminEmail } from "@/lib/admin-email";
import { toast } from "sonner";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AddAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createAdmin = useCreateAdmin();
  const [alias, setAlias] = useState("");
  const [role, setRole] = useState<PlatformAdminRole>("support");
  const email = toAdminEmail(alias);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAlias(alias)) {
      toast.error("Enter an alias without the domain, e.g. teammate");
      return;
    }
    createAdmin.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success(`${email} added as ${ROLE_LABELS[role]}`);
          setAlias("");
          setRole("support");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add admin"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add platform admin</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label htmlFor="admin-alias" className="mb-1.5 block text-sm font-medium">
              Alias
            </label>
            <div className="flex items-stretch rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <Input
                id="admin-alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="teammate"
                autoComplete="off"
                autoCapitalize="none"
                className="border-0 focus-visible:ring-0 rounded-r-none"
                required
              />
              <span className="flex items-center rounded-r-lg bg-muted px-2.5 text-sm text-muted-foreground">
                @{ADMIN_EMAIL_DOMAIN}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Just the alias — every admin is on <code>@{ADMIN_EMAIL_DOMAIN}</code>. If they have no
              account yet, one is created as a platform user (never an owner); they set their own
              password the first time they sign in.
            </p>
          </div>
          <div>
            <label htmlFor="admin-role" className="mb-1.5 block text-sm font-medium">
              Role
            </label>
            <select
              id="admin-role"
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformAdminRole)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="support">Support - read access, tenant approvals</option>
              <option value="super_admin">Super Admin - full access, manages admins</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAdmin.isPending}>
              {createAdmin.isPending ? "Adding..." : "Add admin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminsPage() {
  const me = useAdminSession();
  const { data: admins, isLoading } = useAdminAdmins();
  const updateAdmin = useUpdateAdmin();
  const removeAdmin = useRemoveAdmin();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PlatformAdminRow | null>(null);

  function handleRoleChange(row: PlatformAdminRow, role: PlatformAdminRole) {
    updateAdmin.mutate(
      { adminId: row.id, role },
      {
        onSuccess: () => toast.success(`${row.email} is now ${ROLE_LABELS[role]}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update role"),
      },
    );
  }

  function handleToggleActive(row: PlatformAdminRow) {
    updateAdmin.mutate(
      { adminId: row.id, isActive: !row.isActive },
      {
        onSuccess: () =>
          toast.success(`${row.email} ${row.isActive ? "deactivated" : "reactivated"}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update"),
      },
    );
  }

  function handleRemove() {
    if (!pendingRemoval) return;
    const row = pendingRemoval;
    removeAdmin.mutate(row.id, {
      onSuccess: () => {
        toast.success(`${row.email} removed`);
        setPendingRemoval(null);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Platform Admins</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Who can access this console, and at what level.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add admin
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins?.map((row) => {
              const isMe = row.id === me.id;
              // Root admins are untouchable by anyone; self is untouchable by
              // you. Either way the controls lock, and the API enforces it too.
              const locked = isMe || row.isRoot;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name ?? "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      {isMe && <Badge variant="secondary">You</Badge>}
                      {row.isRoot && <Badge variant="secondary">Protected</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Role for ${row.email}`}
                      value={row.role}
                      disabled={locked || updateAdmin.isPending}
                      onChange={(e) => handleRoleChange(row, e.target.value as PlatformAdminRole)}
                      className="h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                    >
                      <option value="support">Support</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={locked || updateAdmin.isPending}
                        onClick={() => handleToggleActive(row)}
                      >
                        {row.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => setPendingRemoval(row)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        You cannot change your own role or deactivate yourself, the last active super admin cannot
        be removed, and a protected root admin cannot be changed at all. All enforced by the API,
        not just hidden here.
      </p>

      <AddAdminDialog open={addOpen} onOpenChange={setAddOpen} />

      <Dialog open={!!pendingRemoval} onOpenChange={(v) => !v && setPendingRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove admin access?</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pendingRemoval?.email}</span> will lose
            access to this console immediately. Their PGKhata account is not affected. Prefer
            Deactivate if you may restore access later.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingRemoval(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeAdmin.isPending}>
              {removeAdmin.isPending ? "Removing..." : "Remove access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
