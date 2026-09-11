"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuditLog, type AuditLogFilters, type AuditLogRow } from "@/hooks/use-admin-audit";
import { useAdminAdmins } from "@/hooks/use-admin-admins";
import { useAdminSession } from "@/components/admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ScrollText, ShieldAlert, UserCog } from "lucide-react";
import { AuditDetailDialog } from "./audit-detail-dialog";
import { formatTimestamp, statusVariant } from "./audit-format";

const PAGE_SIZE = 50;

/** Suggestions only - the field stays free text so a new entity type still works. */
const ENTITY_TYPE_SUGGESTIONS = [
  "owner",
  "property",
  "floor",
  "room",
  "bed",
  "tenant",
  "bill",
  "payment",
  "blog_post",
  "platform_admin",
  "impersonation_session",
];

function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Split from the page so that a support admin never mounts these hooks — both
 * `/v1/admin/audit` and `/v1/admin/admins` are super admin only and would just
 * return 403s.
 */
function AuditConsole() {
  // Draft values for the free-text fields, debounced into `committed` so we do
  // not fire a query on every keystroke.
  const [actionDraft, setActionDraft] = useState("");
  const [entityDraft, setEntityDraft] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [committed, setCommitted] = useState({ action: "", entityType: "", ownerId: "" });

  const [adminUserId, setAdminUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted({
        action: actionDraft.trim(),
        entityType: entityDraft.trim(),
        ownerId: ownerDraft.trim(),
      });
      // A changed filter invalidates whatever page number we were on.
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [actionDraft, entityDraft, ownerDraft]);

  const filters: AuditLogFilters = useMemo(
    () => ({
      action: committed.action || undefined,
      entityType: committed.entityType || undefined,
      ownerId: committed.ownerId || undefined,
      adminUserId: adminUserId || undefined,
      from: fromDate ? startOfDayIso(fromDate) : undefined,
      to: toDate ? endOfDayIso(toDate) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [committed, adminUserId, fromDate, toDate, page],
  );

  const { data: rows, isLoading, isFetching, isError, error } = useAuditLog(filters);
  const { data: admins } = useAdminAdmins();

  const hasFilters =
    !!committed.action ||
    !!committed.entityType ||
    !!committed.ownerId ||
    !!adminUserId ||
    !!fromDate ||
    !!toDate;

  function clearFilters() {
    setActionDraft("");
    setEntityDraft("");
    setOwnerDraft("");
    setAdminUserId("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  // The API paginates via X-Has-More, which our shared fetch wrapper does not
  // surface, so a full page is our only signal that another one may exist.
  const rowCount = rows?.length ?? 0;
  const hasMore = rowCount === PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Who changed an owner&apos;s data, when, and why. Append-only and retained for 24 months.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-xs text-muted-foreground">
            Action starts with
          </label>
          <Input
            id="audit-action"
            value={actionDraft}
            onChange={(e) => setActionDraft(e.target.value)}
            placeholder="bill.void"
          />
        </div>

        <div>
          <label htmlFor="audit-entity" className="mb-1 block text-xs text-muted-foreground">
            Entity type
          </label>
          <Input
            id="audit-entity"
            list="audit-entity-types"
            value={entityDraft}
            onChange={(e) => setEntityDraft(e.target.value)}
            placeholder="Any entity"
          />
          <datalist id="audit-entity-types">
            {ENTITY_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="audit-admin" className="mb-1 block text-xs text-muted-foreground">
            Admin
          </label>
          <select
            id="audit-admin"
            value={adminUserId}
            onChange={(e) => {
              setAdminUserId(e.target.value);
              setPage(1);
            }}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any admin</option>
            {admins?.map((a) => (
              <option key={a.id} value={a.userId}>
                {a.email ?? a.name ?? a.userId}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="audit-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="audit-owner"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            placeholder="Paste an owner ID"
            className="font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="audit-from" className="mb-1 block text-xs text-muted-foreground">
              From
            </label>
            <Input
              id="audit-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="audit-to" className="mb-1 block text-xs text-muted-foreground">
              To
            </label>
            <Input
              id="audit-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex items-end">
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <p className="p-12 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load the audit log."}
          </p>
        ) : rowCount === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {hasFilters ? "No entries match these filters" : "No audit entries yet"}
            </p>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((row: AuditLogRow) => (
                <TableRow key={row.id} onClick={() => setOpenId(row.id)} className="cursor-pointer">
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {row.impersonationSessionId && (
                        <span
                          title="Made while acting as the owner"
                          className="inline-flex items-center gap-1 rounded-4xl bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400"
                        >
                          <UserCog className="h-3 w-3" />
                          As owner
                        </span>
                      )}
                      <span className="truncate">{row.adminEmail ?? "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.entityType ?? "-"}
                    {row.entityId && (
                      <span className="ml-1 font-mono text-xs opacity-60">
                        {row.entityId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.ownerId ? (
                      <Link
                        href={`/dashboard/owners/${row.ownerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {row.ownerId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.statusCode)}>{row.statusCode ?? "-"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenId(row.id)}
                      aria-label={`View ${row.action} entry`}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} &middot; showing {rowCount} {rowCount === 1 ? "entry" : "entries"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AuditDetailDialog auditId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

export default function AuditPage() {
  const me = useAdminSession();

  if (me.role !== "super_admin") {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium">The audit log is super admin only</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own actions are still recorded. The API enforces this, not just this screen.
        </p>
      </div>
    );
  }

  return <AuditConsole />;
}
