"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useImpersonationSessions,
  useEndImpersonationSession,
  useEndAllImpersonations,
  type ImpersonationSessionRow,
} from "@/hooks/use-impersonation";
import { useAdminSession } from "@/components/admin-session";
import { Button } from "@/components/ui/button";
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
import { Pencil, Eye, UserCog } from "lucide-react";
import { toast } from "sonner";

function formatTimestamp(value: string): string {
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
 * "in 22m" / "expired" - the number an operator actually wants while triaging.
 * `now` is the timestamp of the last successful fetch rather than `Date.now()`:
 * reading the clock during render is impure, and the list refetches every
 * minute anyway, so the two never drift by more than that.
 */
function formatCountdown(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return "-";
  if (ms <= 0) return "expired";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  return `in ${Math.round(minutes / 60)}h`;
}

function ModeBadge({ mode }: { mode: ImpersonationSessionRow["mode"] }) {
  if (mode === "read_write") {
    return (
      <Badge variant="destructive" className="gap-1">
        <Pencil className="h-3 w-3" />
        Read / write
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Eye className="h-3 w-3" />
      Read only
    </Badge>
  );
}

function OwnerCell({ ownerId }: { ownerId: string }) {
  return (
    <Link
      href={`/dashboard/owners/${ownerId}`}
      className="font-mono text-xs text-primary hover:underline"
    >
      {ownerId.slice(0, 8)}
    </Link>
  );
}

export default function SupportSessionsPage() {
  const me = useAdminSession();
  const { data: sessions, isLoading, isError, error, dataUpdatedAt } = useImpersonationSessions();
  const endSession = useEndImpersonationSession();
  const endAll = useEndAllImpersonations();
  const [pendingEnd, setPendingEnd] = useState<ImpersonationSessionRow | null>(null);
  const [endAllOpen, setEndAllOpen] = useState(false);

  const { live, ended } = useMemo(() => {
    const rows = sessions ?? [];
    return {
      live: rows.filter((s) => s.endedAt === null),
      ended: rows.filter((s) => s.endedAt !== null),
    };
  }, [sessions]);

  const writableLive = live.filter((s) => s.mode === "read_write").length;

  function handleEnd() {
    if (!pendingEnd) return;
    const row = pendingEnd;
    endSession.mutate(row.id, {
      onSuccess: () => {
        toast.success("Support session ended");
        setPendingEnd(null);
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not end that session"),
    });
  }

  function handleEndAll() {
    endAll.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`${res.ended} session${res.ended === 1 ? "" : "s"} ended`);
        setEndAllOpen(false);
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not end the sessions"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Support Sessions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Admins currently acting as an owner.
            {me.role === "super_admin"
              ? " You see every admin's sessions."
              : " You see your own sessions."}
          </p>
        </div>
        {me.role === "super_admin" && live.length > 1 && (
          <Button variant="destructive" onClick={() => setEndAllOpen(true)}>
            End all {live.length} sessions
          </Button>
        )}
      </div>

      {isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load support sessions."}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Live now</h2>
          <Badge variant={live.length > 0 ? "default" : "secondary"}>{live.length}</Badge>
          {writableLive > 0 && (
            <span className="text-xs text-destructive">
              {writableLive} can change owner data right now
            </span>
          )}
        </div>

        <div className="rounded-xl border bg-card shadow-xs">
          {live.length === 0 ? (
            <div className="p-10 text-center">
              <UserCog className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No one is acting as an owner right now
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.map((s) => {
                  const expired = new Date(s.expiresAt).getTime() <= dataUpdatedAt;
                  return (
                    <TableRow
                      key={s.id}
                      className={s.mode === "read_write" ? "bg-destructive/5" : undefined}
                    >
                      <TableCell className="font-medium">
                        {s.adminName ?? s.adminUserId.slice(0, 8)}
                        {s.adminUserId === me.userId && (
                          <Badge variant="secondary" className="ml-1.5">
                            You
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <OwnerCell ownerId={s.targetOwnerId} />
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">
                        {s.reason}
                      </TableCell>
                      <TableCell>
                        <ModeBadge mode={s.mode} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(s.startedAt)}
                      </TableCell>
                      <TableCell className={expired ? "text-muted-foreground" : "text-foreground"}>
                        {formatCountdown(s.expiresAt, dataUpdatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingEnd(s)}
                          disabled={endSession.isPending}
                        >
                          End session
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Ended</h2>
          <Badge variant="secondary">{ended.length}</Badge>
        </div>

        <div className="rounded-xl border bg-card shadow-xs">
          {ended.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No completed sessions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>How it ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ended.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.adminName ?? s.adminUserId.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <OwnerCell ownerId={s.targetOwnerId} />
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {s.reason}
                    </TableCell>
                    <TableCell>
                      <ModeBadge mode={s.mode} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(s.startedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.endedAt ? formatTimestamp(s.endedAt) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.endedReason ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Every session is recorded, and so is each action taken inside it. Ending a session is
        immediate and the admin is signed out of the owner&apos;s account.
      </p>

      <Dialog open={!!pendingEnd} onOpenChange={(open) => !open && setPendingEnd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this support session?</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {pendingEnd?.adminName ?? "This admin"}
            </span>{" "}
            will immediately stop acting as the owner. Anything already changed stays changed - the
            audit log keeps the record.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingEnd(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>
              {endSession.isPending ? "Ending..." : "End session"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={endAllOpen} onOpenChange={setEndAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End all {live.length} live sessions?</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            Every admin currently acting as an owner is cut off at once, including yourself. Use
            this when you suspect something is wrong, not for routine cleanup.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEndAllOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEndAll} disabled={endAll.isPending}>
              {endAll.isPending ? "Ending..." : "End all sessions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
