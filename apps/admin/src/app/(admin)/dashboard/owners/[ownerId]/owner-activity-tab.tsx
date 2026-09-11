"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession } from "@/components/admin-session";
import { useAuditLog } from "@/hooks/use-admin-audit";
import { ArrowRight, Eye } from "lucide-react";
import { EmptyNote, formatRelative, Panel } from "./owner-ui";

function timestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Everything an admin has done to this account, which is the first thing to
 * check when an owner says "someone changed my rent". The audit endpoint is
 * super-admin only, so support sees an explanation instead of a 403 — firing a
 * request we know will be refused would just put noise in the log.
 */
export function OwnerActivityTab({ ownerId, asOf }: { ownerId: string; asOf: number }) {
  const admin = useAdminSession();

  // Rendered as a separate component so the query is never even created for a
  // support admin — a hook cannot be called conditionally, but a component can.
  if (admin.role !== "super_admin") {
    return (
      <Panel title="Admin activity">
        <EmptyNote>
          The audit log is restricted to super admins. Ask one to check this account&apos;s history.
        </EmptyNote>
      </Panel>
    );
  }
  return <OwnerAuditList ownerId={ownerId} asOf={asOf} />;
}

function OwnerAuditList({ ownerId, asOf }: { ownerId: string; asOf: number }) {
  const { data, isLoading, error } = useAuditLog({ ownerId, pageSize: 25 });
  const rows = data ?? [];

  return (
    <Panel
      title="Admin activity"
      action={
        <Link
          href="/dashboard/audit"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Full audit log
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <EmptyNote>
          {error instanceof Error ? error.message : "Could not load the audit log."}
        </EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No admin has touched this account.</EmptyNote>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs font-medium">{row.action}</code>
                {row.impersonationSessionId ? (
                  <Badge variant="secondary">
                    <Eye className="h-3 w-3" />
                    via support session
                  </Badge>
                ) : null}
                {row.statusCode !== null && row.statusCode >= 400 ? (
                  <Badge variant="destructive">{row.statusCode}</Badge>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {timestamp(row.createdAt)} · {formatRelative(row.createdAt, asOf)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.adminEmail ?? "unknown admin"}
                {row.reason ? ` — ${row.reason}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
