"use client";

import Link from "next/link";
import { useAuditLogEntry } from "@/hooks/use-admin-audit";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCog } from "lucide-react";
import { formatTimestamp, statusVariant } from "./audit-format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm">{children}</div>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {value === null || value === undefined ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Not recorded
        </p>
      ) : (
        <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditDetailDialog({
  auditId,
  onClose,
}: {
  auditId: string | null;
  onClose: () => void;
}) {
  const { data: entry, isLoading, isError, error } = useAuditLogEntry(auditId);

  return (
    <Dialog open={!!auditId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entry ? entry.action : "Audit entry"}</DialogTitle>
          <DialogDescription>
            {entry
              ? `${formatTimestamp(entry.createdAt)} by ${entry.adminEmail ?? "unknown admin"}`
              : "Loading the recorded change..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {isError && (
          <p className="py-6 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load this entry."}
          </p>
        )}

        {entry && (
          <div className="space-y-4">
            {entry.impersonationSessionId && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500" />
                <div className="min-w-0 text-xs">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Made while impersonating an owner
                  </p>
                  <p className="mt-0.5 font-mono break-all text-amber-800/80 dark:text-amber-300/80">
                    session {entry.impersonationSessionId}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Actor">{entry.adminEmail ?? "-"}</Field>
              <Field label="Entity">
                {entry.entityType ? (
                  <span>
                    {entry.entityType}
                    {entry.entityId && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {entry.entityId}
                      </span>
                    )}
                  </span>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Owner">
                {entry.ownerId ? (
                  <Link
                    href={`/dashboard/owners/${entry.ownerId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {entry.ownerId}
                  </Link>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Request">
                <span className="font-mono text-xs">
                  {entry.method ?? "-"} {entry.path ?? ""}
                </span>
              </Field>
              <Field label="Result">
                <Badge variant={statusVariant(entry.statusCode)}>{entry.statusCode ?? "-"}</Badge>
              </Field>
              <Field label="IP address">
                <span className="font-mono text-xs">{entry.ipAddress ?? "-"}</span>
              </Field>
            </div>

            {entry.reason && (
              <div>
                <p className="text-xs text-muted-foreground">Reason given</p>
                <p className="mt-0.5 text-sm">{entry.reason}</p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <Snapshot label="Before" value={entry.before} />
              <Snapshot label="After" value={entry.after} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
