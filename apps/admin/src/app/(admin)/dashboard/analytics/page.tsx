"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  Bed,
  Building2,
  ChevronRight,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";
import {
  usePlatformAnalytics,
  useAnalyticsTrends,
  useMetricsChurnRisk,
  useMetricsFunnel,
  useMetricsOverview,
  useMetricsRetention,
  useMetricsVolume,
  BED_STAGE_KEY,
  VOLUME_MONTH_OPTIONS,
  type ChurnRiskRow,
  type FunnelReport,
  type MetricDelta,
  type RetentionReport,
} from "@/hooks/use-admin-metrics";
import { AdminStatCard } from "@/components/admin-stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything renders `null`/`undefined` as an em dash. These figures get read
 * aloud on calls, so a missing value printed as `0` is a fabricated fact — and
 * a fabricated zero ("nobody churned this month") is worse than a visible
 * blank.
 */
function count(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

function percent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

function days(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value < 1) return "same day";
  return `${Math.round(value * 10) / 10}d`;
}

/** `2026-03` to `Mar 2026`. Falls back to the raw label rather than guessing. */
function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/* -------------------------------------------------------------------------- */
/* Shell pieces                                                                */
/* -------------------------------------------------------------------------- */

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Names the endpoint that failed, so "nothing to show" can be told apart from
 * "this endpoint is down" without opening devtools.
 */
function LoadError({ endpoint, error }: { endpoint: string; error: unknown }) {
  return (
    <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-medium text-destructive">Could not load {endpoint}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {error instanceof Error ? error.message : "Request failed."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        This section is left blank rather than filled with zeroes.
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Rows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

const TH = "px-4 py-2.5 font-medium";
const TD = "px-4 py-2.5 text-right font-mono tabular-nums";

function TableFrame({
  caption,
  head,
  children,
  foot,
}: {
  caption: string;
  head: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
        {foot ? <tfoot>{foot}</tfoot> : null}
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Platform analytics.
 *
 * Two things this page is careful about, both of which the previous version got
 * wrong:
 *
 * 1. Every series says whether it is per-month or cumulative. The old table
 *    rendered running totals under a heading that read "Monthly Trends", so a
 *    flat business looked like it grew every single month and could never show
 *    a decline. Collections were worse: summing `bill.paid_amount` — a
 *    *current* column — by the bill's month meant cash recorded today silently
 *    inflated months that had already been reported.
 *
 * 2. Money is never called revenue. PGKhata has no payment gateway and none of
 *    this cash touches the company; it is rent tenants pay their landlords
 *    directly. It is volume under management, and mislabelling it is how a
 *    number the company has no claim to ends up in a fundraising conversation.
 */
export default function AnalyticsPage() {
  const [volumeMonths, setVolumeMonths] = useState<number>(12);

  const analytics = usePlatformAnalytics();
  const overview = useMetricsOverview();
  const trends = useAnalyticsTrends();
  const volume = useMetricsVolume(volumeMonths);
  const funnel = useMetricsFunnel();
  const retention = useMetricsRetention();
  const churn = useMetricsChurnRisk();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Platform Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Growth, activation and retention across every owner on the platform. All months are
          Asia/Kolkata calendar months.
        </p>
      </div>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <strong className="font-medium">Amounts here are volume under management.</strong>{" "}
        <span className="text-muted-foreground">
          {volume.data?.disclaimer ??
            "PGKhata has no payment gateway and never handles this money; these are amounts owners billed and recorded as collected themselves. It is not revenue and must not be quoted as such."}
        </span>
      </p>

      {/* ---------------------------------------------------------------- */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analytics.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <AdminStatCard
              label="Owners"
              value={count(analytics.data?.totalOwners)}
              icon={Users}
              description="Registered, excluding deleted"
            />
            <AdminStatCard
              label="Activated owners"
              value={count(analytics.data?.activatedOwners)}
              icon={Activity}
              description="Have generated at least one bill"
            />
            <AdminStatCard
              label="Properties"
              value={count(analytics.data?.totalProperties)}
              icon={Building2}
              description="PG properties created"
            />
            <AdminStatCard
              label="Active tenants"
              value={count(analytics.data?.activeTenants)}
              icon={UserCheck}
              description="Currently occupying a bed"
            />
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title="This month vs last"
        description={
          overview.data
            ? `${monthLabel(overview.data.month)} against ${monthLabel(overview.data.previousMonth)}. The running month is a partial figure by construction, so each tile states its basis.`
            : "Signups, verification and activation against the previous period."
        }
      >
        {overview.isLoading ? (
          <Rows n={2} />
        ) : overview.isError ? (
          <LoadError endpoint="GET /v1/admin/metrics/overview" error={overview.error} />
        ) : overview.data ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeltaTile
              label="Signups"
              metric={overview.data.signups}
              definition={overview.data.definitions.signups}
            />
            <DeltaTile
              label="Verified"
              metric={overview.data.verified}
              definition={overview.data.definitions.verified}
            />
            <DeltaTile
              label="Activated"
              metric={overview.data.activated}
              definition={overview.data.definitions.activated}
            />
            <DeltaTile
              label="Active owners"
              metric={overview.data.activeLast30d}
              definition={overview.data.definitions.activeLast30d}
            />
          </dl>
        ) : (
          <Empty>The overview endpoint returned nothing.</Empty>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title="Growth, per month"
        description="Owners, properties and tenancies added during each month — not running totals. The cumulative columns are labelled as such and kept beside them so the two can never be confused again."
      >
        {trends.isLoading ? (
          <Rows />
        ) : trends.isError ? (
          <LoadError endpoint="GET /v1/admin/analytics/trends" error={trends.error} />
        ) : (trends.data?.length ?? 0) === 0 ? (
          <Empty>The trends endpoint returned no months.</Empty>
        ) : (
          <TableFrame
            caption="Owners, properties and tenancies added in each month, with cumulative totals"
            head={
              <>
                <th scope="col" className={TH}>
                  Month
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  New owners
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  New properties
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Tenancies started
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Owners (cumulative)
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Active tenants (month end)
                </th>
              </>
            }
          >
            {trends.data?.map((row) => (
              <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  {monthLabel(row.month)}
                </th>
                <td className={TD}>{count(row.owners)}</td>
                <td className={TD}>{count(row.properties)}</td>
                <td className={TD}>{count(row.tenants)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{count(row.cumulativeOwners)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{count(row.activeTenants)}</td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title={volume.data?.label ?? "Volume under management, per month"}
        description="Billed for each business month, and cash recorded in that calendar month from the payment ledger. Collected comes from the ledger rather than from the bill's current paid amount, so a month reports the same number every time you open it."
        action={
          <div className="flex shrink-0 gap-1">
            {VOLUME_MONTH_OPTIONS.map((option) => (
              <Button
                key={option}
                variant={volumeMonths === option ? "default" : "outline"}
                size="sm"
                onClick={() => setVolumeMonths(option)}
              >
                {option}m
              </Button>
            ))}
          </div>
        }
      >
        {volume.isLoading ? (
          <Rows />
        ) : volume.isError ? (
          <LoadError endpoint="GET /v1/admin/metrics/volume" error={volume.error} />
        ) : (volume.data?.months.length ?? 0) === 0 ? (
          <Empty>The volume endpoint returned no months.</Empty>
        ) : (
          <TableFrame
            caption="Amount billed, collected and outstanding for each month"
            head={
              <>
                <th scope="col" className={TH}>
                  Month
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Billed in month
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Collected in month
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Still outstanding
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Settled
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Bills
                </th>
              </>
            }
            foot={
              volume.data ? (
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-2.5">Total</td>
                  <td className={TD}>{money(volume.data.totals.billed)}</td>
                  <td className={TD}>{money(volume.data.totals.collected)}</td>
                  <td className={TD}>{money(volume.data.totals.outstanding)}</td>
                  <td className={TD}>{percent(volume.data.totals.collectionRate)}</td>
                  <td />
                </tr>
              ) : undefined
            }
          >
            {volume.data?.months.map((row) => (
              <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  {monthLabel(row.month)}
                </th>
                <td className={TD}>{money(row.billed)}</td>
                <td className={TD}>{money(row.collected)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{money(row.outstanding)}</td>
                <td className={TD}>{percent(row.collectionRate)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{count(row.billCount)}</td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title="Activation funnel"
        description="How far owners get, and how long each step takes. Beds are the step that matters: a property with rooms but no beds cannot take a tenant, so an owner who stalls there never bills anyone."
      >
        {funnel.isLoading ? (
          <Rows n={7} />
        ) : funnel.isError ? (
          <LoadError endpoint="GET /v1/admin/metrics/funnel" error={funnel.error} />
        ) : !funnel.data || funnel.data.stages.length === 0 ? (
          <Empty>The funnel endpoint returned no stages.</Empty>
        ) : (
          <FunnelSection report={funnel.data} />
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title="Retention by signup cohort"
        description={
          retention.data?.definition ??
          "An owner counts as retained in a month only if they generated at least one bill that month. Logging in is not retention for this product."
        }
      >
        {retention.isLoading ? (
          <Rows />
        ) : retention.isError ? (
          <LoadError endpoint="GET /v1/admin/metrics/retention" error={retention.error} />
        ) : !retention.data || retention.data.cohorts.length === 0 ? (
          <Empty>The retention endpoint returned no cohorts.</Empty>
        ) : (
          <RetentionGrid report={retention.data} />
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}

      <Panel
        title="Churn risk"
        description={
          churn.data
            ? `A worklist, not a chart — ${count(churn.data.counts.owners)} owners flagged. Collection rates compare ${monthLabel(churn.data.comparedMonths.previous)} with ${monthLabel(churn.data.comparedMonths.current)}, the two most recent complete months.`
            : "A worklist, not a chart. Each row is an owner someone should call."
        }
      >
        {churn.isLoading ? (
          <Rows />
        ) : churn.isError ? (
          <LoadError endpoint="GET /v1/admin/metrics/churn-risk" error={churn.error} />
        ) : !churn.data || churn.data.rows.length === 0 ? (
          <Empty>No owners are currently flagged at risk.</Empty>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {churn.data.rows.map((owner) => (
                <ChurnRow key={owner.ownerId} owner={owner} />
              ))}
            </ul>
            {churn.data.truncated ? (
              <p className="text-xs text-muted-foreground">
                The list was cut at the server&apos;s cap — there are more at-risk owners than
                shown here.
              </p>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const BASIS_LABELS: Record<MetricDelta["basis"], string> = {
  cohort_month: "vs last month (month still running)",
  rolling_30d: "last 30d vs the 30 before",
};

function DeltaTile({
  label,
  metric,
  definition,
}: {
  label: string;
  metric: MetricDelta;
  definition?: string;
}) {
  const up = metric.delta > 0;
  const flat = metric.delta === 0;

  return (
    <div className="rounded-lg border p-3" title={definition}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{count(metric.value)}</dd>
      <dd className="mt-0.5 text-xs">
        <span
          className={cn(
            "font-medium",
            flat
              ? "text-muted-foreground"
              : up
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-700 dark:text-red-400",
          )}
        >
          {flat ? "no change" : `${up ? "+" : ""}${count(metric.delta)}`}
          {/* deltaPct is null when the previous period was 0: there is no base
              to have changed from, and "+100%" would invent one. */}
          {metric.deltaPct !== null ? ` (${percent(metric.deltaPct)})` : ""}
        </span>
        <span className="text-muted-foreground"> · {BASIS_LABELS[metric.basis]}</span>
      </dd>
    </div>
  );
}

/**
 * The funnel as a table with a decorative bar rather than a chart. There is no
 * charting dependency in this app, and a clean table beats a bad chart; the bar
 * is `aria-hidden` because the number beside it is the fact.
 */
function FunnelSection({ report }: { report: FunnelReport }) {
  const top = report.stages[0]?.count ?? 0;

  return (
    <div className="space-y-3">
      {report.biggestDropOff ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            report.biggestDropOff.to === BED_STAGE_KEY
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border bg-muted/30",
          )}
        >
          <strong className="font-medium">Biggest drop-off:</strong>{" "}
          {report.biggestDropOff.from} &rarr; {report.biggestDropOff.to} loses{" "}
          {count(report.biggestDropOff.lostOwners)} owners ({percent(report.biggestDropOff.lostPct)}
          ).
        </p>
      ) : null}

      <TableFrame
        caption="Owners reaching each activation stage, with median time to get there"
        head={
          <>
            <th scope="col" className={TH}>
              Stage
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Owners
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Of all signups
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              From previous stage
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Median from previous
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Median from signup
            </th>
            <th scope="col" className={cn(TH, "w-28 sr-only")}>
              Share
            </th>
          </>
        }
      >
        {report.stages.map((stage) => {
          const bed = stage.key === BED_STAGE_KEY;
          const share = top > 0 ? (stage.count / top) * 100 : 0;

          return (
            <tr
              key={stage.key}
              className={cn("border-b last:border-0", bed ? "bg-amber-500/5" : "hover:bg-muted/30")}
            >
              <th scope="row" className="px-4 py-2.5 text-left font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  {bed ? <Bed className="h-3.5 w-3.5 text-amber-700" /> : null}
                  {stage.label}
                  {bed ? (
                    <span className="rounded-4xl bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
                      no beds, no tenants
                    </span>
                  ) : null}
                </span>
              </th>
              <td className={TD}>{count(stage.count)}</td>
              <td className={cn(TD, "text-muted-foreground")}>{percent(stage.pctOfSignups)}</td>
              <td className={TD}>{percent(stage.conversionFromPrevious)}</td>
              <td className={TD}>{days(stage.medianDaysFromPrevious)}</td>
              <td className={cn(TD, "text-muted-foreground")}>
                {days(stage.medianDaysFromSignup)}
              </td>
              <td className="px-4 py-2.5">
                <div aria-hidden className="h-1.5 w-full rounded-4xl bg-muted">
                  <div
                    className={cn("h-1.5 rounded-4xl", bed ? "bg-amber-500" : "bg-primary/70")}
                    style={{ width: `${Math.max(2, share)}%` }}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </TableFrame>

      {report.notes.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The classic cohort triangle. Cells stop where the data does — a cohort three
 * months old has no month-five column, and padding one in with a zero would
 * read as "everybody left".
 */
function RetentionGrid({ report }: { report: RetentionReport }) {
  const maxPeriod = report.cohorts.reduce(
    (max, cohort) => Math.max(max, ...cohort.periods.map((p) => p.period)),
    0,
  );
  const periods = Array.from({ length: maxPeriod + 1 }, (_, i) => i);

  return (
    <TableFrame
      caption="Share of each signup cohort that generated at least one bill, by months since signup"
      head={
        <>
          <th scope="col" className={TH}>
            Cohort
          </th>
          <th scope="col" className={cn(TH, "text-right")}>
            Owners
          </th>
          {periods.map((period) => (
            <th key={period} scope="col" className={cn(TH, "text-right")}>
              {period === 0 ? "Signup month" : `+${period}m`}
            </th>
          ))}
        </>
      }
      foot={
        <tr className="border-t bg-muted/30 text-muted-foreground">
          <td className="px-4 py-2.5 font-medium">Average</td>
          <td />
          {periods.map((period) => {
            const average = report.averageByPeriod.find((a) => a.period === period);
            return (
              <td key={period} className={TD}>
                {average ? percent(average.rate) : "—"}
              </td>
            );
          })}
        </tr>
      }
    >
      {report.cohorts.map((cohort) => (
        <tr key={cohort.cohort} className="border-b last:border-0 hover:bg-muted/30">
          <th scope="row" className="px-4 py-2.5 text-left font-medium">
            {monthLabel(cohort.cohort)}
          </th>
          <td className={cn(TD, "text-muted-foreground")}>{count(cohort.size)}</td>
          {periods.map((period) => {
            const cell = cohort.periods.find((p) => p.period === period);
            return (
              <td key={period} className={TD}>
                {cell ? (
                  <span title={`${count(cell.retained)} of ${count(cohort.size)} owners`}>
                    {percent(cell.rate)}
                  </span>
                ) : (
                  // Not yet elapsed. Blank, not zero.
                  <span className="text-muted-foreground/40">·</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </TableFrame>
  );
}

function ChurnRow({ owner }: { owner: ChurnRiskRow }) {
  // Prefer the API's link, but only if it is an in-app path.
  const href = owner.href?.startsWith("/") ? owner.href : `/dashboard/owners/${owner.ownerId}`;
  const high = owner.severity === "high";

  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <TriangleAlert
              className={cn("h-3.5 w-3.5 shrink-0", high ? "text-red-600" : "text-amber-600")}
            />
            <span className="truncate text-sm font-medium">{owner.name || owner.email}</span>
            <span
              className={cn(
                "shrink-0 rounded-4xl px-2 py-0.5 text-xs font-medium",
                high
                  ? "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
              )}
            >
              {owner.severity}
            </span>
          </span>

          <span className="mt-1 block text-xs text-muted-foreground">
            {owner.reasons.map((reason) => reason.message).join(" · ") || "No reason reported"}
          </span>

          <span className="mt-1 block text-xs text-muted-foreground">
            {count(owner.activeTenants)} active tenants · {count(owner.beds)} beds ·{" "}
            {owner.daysSinceLastBill === null
              ? "never billed"
              : `last bill ${count(owner.daysSinceLastBill)}d ago`}
            {owner.collectionRate !== null
              ? ` · collection ${percent(owner.previousCollectionRate)} → ${percent(owner.collectionRate)}`
              : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
