"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Small shared pieces for the comms console.
 *
 * One rule runs through all of them: a number the API did not send renders as
 * an em dash, never as `0`. "Zero failures" and "we could not reach the
 * deliveries endpoint" are opposite facts and must not look alike.
 */

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `asOf` is passed in rather than read from the clock. `Date.now()` during
 * render is impure — React may render twice and get two different answers —
 * so the caller hands down TanStack Query's `dataUpdatedAt`, which is also the
 * more truthful reference point for "8m ago".
 */
export function formatRelative(value: string | null | undefined, asOf: number): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const delta = asOf - then;
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  const days = Math.floor(delta / DAY);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * The honest failure state. It names the endpoint so that "nothing here" can be
 * told apart from "this endpoint is not live yet" without opening devtools.
 */
export function LoadError({ endpoint, error }: { endpoint: string; error: unknown }) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return (
    <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-medium text-destructive">Could not load {endpoint}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        No figure is shown for this section rather than a zero that would read as good news.
      </p>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  queued: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
  failed: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
  skipped: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function ChannelPill({ channel }: { channel: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-4xl px-2 py-0.5 text-xs font-medium",
        channel === "whatsapp"
          ? "bg-green-100 text-green-900 dark:bg-green-500/15 dark:text-green-300"
          : "bg-slate-100 text-slate-900 dark:bg-slate-500/15 dark:text-slate-300",
      )}
    >
      {channel}
    </span>
  );
}
