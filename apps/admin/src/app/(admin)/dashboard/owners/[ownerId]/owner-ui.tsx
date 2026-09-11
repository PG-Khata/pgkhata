"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { OwnerAccountStatus } from "@/hooks/use-owner-overview";

/**
 * Small shared pieces for Owner 360. They exist mostly to enforce one rule:
 * a value the API did not send renders as an em dash, never as `0`. An agent
 * reads these numbers out to an owner on the phone, and "you owe nothing" is a
 * very expensive way to say "the server didn't answer".
 */

export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `asOf` is passed in rather than read from the clock, because calling
 * `Date.now()` while rendering is impure — React may render this twice and get
 * two different answers. The caller hands down the moment the data was
 * fetched, which is also the more truthful reference point for "2 days ago".
 */
export function formatRelative(iso: string | null | undefined, asOf: number): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const delta = asOf - then;
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  const days = Math.floor(delta / DAY);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const STATUS_STYLES: Record<OwnerAccountStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800" },
  pending_deletion: { label: "Pending deletion", className: "bg-amber-100 text-amber-900" },
  deleted: { label: "Deleted", className: "bg-muted text-muted-foreground" },
};

export function AccountStatusBadge({ status }: { status: OwnerAccountStatus | undefined }) {
  if (!status) return <Badge variant="outline">Status unknown</Badge>;
  const style = STATUS_STYLES[status];
  if (!style) return <Badge variant="outline">{status}</Badge>;
  return <span className={cn("rounded-4xl px-2 py-0.5 text-xs font-medium", style.className)}>{style.label}</span>;
}

/** Clipboard copy for the two fields an agent actually dictates back. */
export function CopyButton({
  value,
  label,
  icon,
}: {
  value: string | null | undefined;
  label: string;
  icon: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={!value}
      title={value ? `Copy ${value}` : `No ${label.toLowerCase()} on file`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : icon}
      <span className="hidden sm:inline">{value ?? `No ${label.toLowerCase()}`}</span>
      <span className="sm:hidden">{label}</span>
      {copied ? null : <Copy className="h-3 w-3 opacity-50" />}
    </Button>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm">{children}</div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * Shown wherever the overview payload is missing a section. It names the field
 * instead of drawing an empty chart, so a gap in the API reads as a gap rather
 * than as "this owner has nothing".
 */
export function MissingData({ what }: { what: string }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
      The overview endpoint did not return {what}.
    </p>
  );
}

export function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      {children}
    </Link>
  );
}
