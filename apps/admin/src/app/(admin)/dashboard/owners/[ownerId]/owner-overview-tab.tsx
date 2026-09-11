"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDashed,
  Mail,
  Phone,
  QrCode,
} from "lucide-react";
import type {
  OwnerChecklistStep,
  OwnerOverview,
  OwnerRiskFlag,
} from "@/hooks/use-owner-overview";
import {
  EmptyNote,
  Field,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  formatRelative,
  MissingData,
  Panel,
} from "./owner-ui";

/** Fallback wording only — a `label` from the API always wins. */
const FLAG_LABELS: Record<string, string> = {
  bills_outstanding_60d: "Bills outstanding for more than 60 days",
  occupied_bed_no_tenant: "Beds marked occupied with no active tenant",
  active_tenant_no_bed: "Active tenants with no bed assigned",
  no_billing_activity_45d: "No billing activity in the last 45 days",
};

const CHECKLIST_ORDER: { step: OwnerChecklistStep; label: string }[] = [
  { step: "property", label: "Added a property" },
  { step: "room", label: "Added a room" },
  { step: "bed", label: "Added a bed" },
  { step: "tenant", label: "Added a tenant" },
  { step: "first_bill", label: "Generated a bill" },
  { step: "first_payment", label: "Recorded a payment" },
];

function severityClass(severity: OwnerRiskFlag["severity"]): string {
  if (severity === "low") return "border-amber-200 bg-amber-50 text-amber-900";
  if (severity === "medium") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-900";
}

function RiskFlagRow({ flag }: { flag: OwnerRiskFlag }) {
  const label = flag.label ?? FLAG_LABELS[flag.code] ?? flag.code;
  const parts = [
    typeof flag.count === "number" ? `${formatCount(flag.count)} affected` : null,
    typeof flag.amount === "number" ? formatMoney(flag.amount) : null,
    flag.detail ?? null,
  ].filter(Boolean);

  const body = (
    <>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {parts.length > 0 ? (
          <span className="block text-xs opacity-80">{parts.join(" · ")}</span>
        ) : null}
      </span>
      {flag.href ? <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60" /> : null}
    </>
  );

  const className = cn(
    "flex items-start gap-2.5 rounded-lg border p-3",
    severityClass(flag.severity),
    flag.href && "transition-opacity hover:opacity-80",
  );

  if (flag.href) {
    return (
      <Link href={flag.href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function Headline({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "danger" | "good";
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold",
          tone === "danger" && "text-red-600",
          tone === "good" && "text-emerald-700",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Ordered for a phone call, not for browsing. The first screen answers "what is
 * wrong with this account right now" — money owed, then the flags, then the
 * settings that quietly break things (a property with no UPI VPA means the
 * tenant literally cannot pay from the bill link). Vanity totals live in the
 * Properties tab where nobody is waiting on them.
 */
export function OwnerOverviewTab({
  overview,
  asOf,
}: {
  overview: OwnerOverview | undefined;
  asOf: number;
}) {
  const billing = overview?.billing;
  const flags = overview?.riskFlags ?? [];
  const portfolio = overview?.portfolio ?? [];
  const checklist = overview?.checklist;
  const identity = overview?.identity;

  const missingUpi = portfolio.filter((property) => property.hasUpiVpa === false);
  const checklistItems = CHECKLIST_ORDER.map((item) => ({
    ...item,
    state: checklist?.[item.step],
  }));
  const hasChecklist = checklistItems.some((item) => item.state !== undefined);
  const incomplete = checklistItems.filter((item) => item.state && !item.state.done);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Headline
          label="Outstanding"
          value={formatMoney(billing?.outstanding)}
          tone={typeof billing?.outstanding === "number" && billing.outstanding > 0 ? "danger" : undefined}
          hint={billing?.month ? `As of ${billing.month}` : undefined}
        />
        <Headline
          label="Collected this month"
          value={formatMoney(billing?.collected)}
          tone="good"
          hint={`Billed ${formatMoney(billing?.billed)}`}
        />
        <Headline
          label="Collection rate"
          value={formatPercent(billing?.collectionRate)}
          hint={`Last payment ${formatRelative(billing?.lastPaymentAt, asOf)}`}
        />
      </div>

      <Panel title={`Needs attention${flags.length ? ` (${flags.length})` : ""}`}>
        {overview?.riskFlags === undefined ? (
          <MissingData what="risk flags" />
        ) : flags.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-600" />
            No overdue bills, orphaned beds or stalled billing.
          </p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag, index) => (
              <RiskFlagRow key={`${flag.code}-${index}`} flag={flag} />
            ))}
          </div>
        )}
      </Panel>

      {missingUpi.length > 0 ? (
        <Panel title="Blocking settings">
          <div className="space-y-2">
            {missingUpi.map((property) => (
              <Link
                key={property.id}
                href={`/dashboard/properties/${property.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 transition-opacity hover:opacity-80"
              >
                <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {property.name} has no UPI VPA
                  </span>
                  <span className="block text-xs opacity-80">
                    Tenants at this property cannot pay from the bill link.
                  </span>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      {hasChecklist && incomplete.length > 0 ? (
        <Panel
          title="Setup not finished"
          action={
            <Badge variant="outline">
              {checklistItems.filter((i) => i.state?.done).length}/{CHECKLIST_ORDER.length}
            </Badge>
          }
        >
          <ol className="space-y-1.5">
            {checklistItems.map((item) => {
              const done = item.state?.done === true;
              const unknown = item.state === undefined;
              return (
                <li key={item.step} className="flex items-center gap-2.5 text-sm">
                  {done ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("flex-1", !done && "font-medium")}>{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {unknown ? "—" : done ? formatRelative(item.state?.at, asOf) : "not yet"}
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}

      <Panel title="Account">
          {!identity ? (
            <EmptyNote>No identity returned.</EmptyNote>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <span className="flex items-center gap-1.5 font-mono">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {identity.phone ?? "—"}
                </span>
              </Field>
              <Field label="Email">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{identity.email}</span>
                </span>
              </Field>
              <Field label="Last login">
                {identity.lastLoginAt === undefined
                  ? "—"
                  : `${formatRelative(identity.lastLoginAt, asOf)}${
                      identity.lastLoginAt ? ` · ${formatDate(identity.lastLoginAt)}` : ""
                    }`}
              </Field>
              <Field label="Joined">{formatDate(identity.createdAt)}</Field>
              <Field label="Last bill generated">
                {formatRelative(billing?.lastBillAt, asOf)}
              </Field>
              <Field label="Properties">{formatCount(portfolio.length)}</Field>
            </div>
          )}
      </Panel>
    </div>
  );
}
