"use client";

import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";

/**
 * Platform metrics for `/dashboard/analytics`.
 *
 * The types here mirror the interfaces exported by
 * `apps/api/src/routes/admin/metrics.ts` rather than being re-imagined. Where a
 * figure can be absent the API already types it `| null`, and the page renders
 * null as an em dash — never as `0`. These numbers get read aloud on calls, and
 * a fabricated zero ("nobody churned this month") is worse than a blank.
 */

/* -------------------------------------------------------------------------- */
/* GET /analytics                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Note there is no `totalUsers`. It was the same number as `totalOwners` by
 * construction — `ensureOwnerProfile` runs on every user create — so the old
 * dashboard printed one figure twice. `activatedOwners` replaces it and means
 * something: owners who have generated at least one non-voided bill.
 */
export interface PlatformAnalytics {
  totalOwners: number;
  activatedOwners: number;
  totalProperties: number;
  activeTenants: number;
}

export function usePlatformAnalytics() {
  return useQuery({
    queryKey: ["admin", "metrics", "analytics"],
    queryFn: () => api.get<PlatformAnalytics>("/v1/admin/analytics"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /analytics/trends                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One IST calendar month.
 *
 * `owners`, `properties` and `tenants` are what was added *in* the month. They
 * used to be cumulative totals served under these same names, which is why the
 * old page could never show a decline. The cumulative figures now have their
 * own, honestly-named fields.
 */
export interface TrendPoint {
  month: string;
  owners: number;
  properties: number;
  tenants: number;
  billed: number;
  collected: number;
  outstanding: number;
  cumulativeOwners: number;
  cumulativeProperties: number;
  activeTenants: number;
}

export function useAnalyticsTrends() {
  return useQuery({
    queryKey: ["admin", "metrics", "trends"],
    queryFn: () => api.get<TrendPoint[]>("/v1/admin/analytics/trends"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /metrics/overview                                                       */
/* -------------------------------------------------------------------------- */

export interface MetricDelta {
  value: number;
  previous: number;
  delta: number;
  /** Null when `previous` is 0 — there is no base to have changed from. */
  deltaPct: number | null;
  /**
   * `cohort_month` compares the running IST month against the last one, so it
   * is partial by construction; `rolling_30d` is complete on both sides. The
   * page prints this rather than presenting the two as the same kind of number.
   */
  basis: "cohort_month" | "rolling_30d";
}

export interface OverviewMetrics {
  timezone: string;
  generatedAt: string;
  month: string;
  previousMonth: string;
  signups: MetricDelta;
  verified: MetricDelta;
  activated: MetricDelta;
  activeLast30d: MetricDelta;
  /** The API ships its own definitions; the page shows them as tooltips. */
  definitions: Record<string, string>;
}

export function useMetricsOverview() {
  return useQuery({
    queryKey: ["admin", "metrics", "overview"],
    queryFn: () => api.get<OverviewMetrics>("/v1/admin/metrics/overview"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /metrics/funnel                                                         */
/* -------------------------------------------------------------------------- */

export type FunnelStageKey =
  | "signup"
  | "email_verified"
  | "property_created"
  | "bed_created"
  | "first_tenant"
  | "first_bill"
  | "first_payment";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  pctOfSignups: number;
  conversionFromPrevious: number | null;
  medianDaysFromSignup: number | null;
  medianDaysFromPrevious: number | null;
}

export interface FunnelReport {
  timezone: string;
  generatedAt: string;
  totalOwners: number;
  stages: FunnelStage[];
  biggestDropOff: {
    from: FunnelStageKey;
    to: FunnelStageKey;
    lostOwners: number;
    lostPct: number;
  } | null;
  notes: string[];
}

/**
 * The step the page calls out. A property with floors and rooms but no beds
 * cannot take a tenant, so an owner who stalls here never bills anyone — it is
 * the difference between a slow signup and a dead one.
 */
export const BED_STAGE_KEY: FunnelStageKey = "bed_created";

export function useMetricsFunnel() {
  return useQuery({
    queryKey: ["admin", "metrics", "funnel"],
    queryFn: () => api.get<FunnelReport>("/v1/admin/metrics/funnel"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /metrics/retention                                                      */
/* -------------------------------------------------------------------------- */

export interface RetentionPeriod {
  /** Months since the cohort's signup month; 0 is the signup month itself. */
  period: number;
  retained: number;
  /** Percent. Supplied by the API, which also owns the definition. */
  rate: number;
}

export interface RetentionCohort {
  cohort: string;
  size: number;
  /** Only periods that have actually elapsed — never padded into the future. */
  periods: RetentionPeriod[];
}

export interface RetentionReport {
  timezone: string;
  generatedAt: string;
  /** "Generated at least one bill that month", in the API's own words. */
  definition: string;
  cohorts: RetentionCohort[];
  averageByPeriod: { period: number; rate: number; cohorts: number }[];
}

export function useMetricsRetention() {
  return useQuery({
    queryKey: ["admin", "metrics", "retention"],
    queryFn: () => api.get<RetentionReport>("/v1/admin/metrics/retention"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /metrics/churn-risk                                                     */
/* -------------------------------------------------------------------------- */

export type ChurnRiskCode = "billing_lapsed" | "no_tenants" | "collection_rate_drop";

export interface ChurnRiskReason {
  code: ChurnRiskCode;
  severity: "high" | "medium";
  message: string;
  metrics: Record<string, number | null>;
}

export interface ChurnRiskRow {
  ownerId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  /** Owner 360 path, supplied by the API. */
  href: string;
  severity: "high" | "medium";
  reasons: ChurnRiskReason[];
  activeTenants: number;
  beds: number;
  daysSinceLastBill: number | null;
  lastBillAt: string | null;
  collectionRate: number | null;
  previousCollectionRate: number | null;
}

export interface ChurnRiskReport {
  generatedAt: string;
  timezone: string;
  thresholds: {
    billingLapsedDays: number;
    noTenantDays: number;
    collectionDropPp: number;
  };
  /** The two *complete* months the collection comparison used. */
  comparedMonths: { current: string; previous: string };
  counts: Record<ChurnRiskCode, number> & { owners: number };
  /** True when the list was cut at the server's cap. */
  truncated: boolean;
  rows: ChurnRiskRow[];
}

export function useMetricsChurnRisk() {
  return useQuery({
    queryKey: ["admin", "metrics", "churn-risk"],
    queryFn: () => api.get<ChurnRiskReport>("/v1/admin/metrics/churn-risk"),
  });
}

/* -------------------------------------------------------------------------- */
/* GET /metrics/volume                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Volume under management — never revenue.
 *
 * PGKhata has no payment gateway and none of this money passes through the
 * company; it is rent tenants pay their landlords directly. The API ships
 * `label` and `disclaimer` in the payload precisely so the wording is not left
 * to whoever builds the screen, and this page renders them rather than writing
 * its own.
 */
export interface VolumeMonth {
  month: string;
  billed: number;
  collected: number;
  outstanding: number;
  /** `billed - outstanding`: how much of this month's billing has settled. */
  settled: number;
  /** `settled / billed`, percent — same axis on both sides, unlike collected. */
  collectionRate: number;
  billCount: number;
  paymentCount: number;
}

export interface VolumeReport {
  label: string;
  disclaimer: string;
  currency: string;
  timezone: string;
  generatedAt: string;
  definitions: Record<string, string>;
  months: VolumeMonth[];
  totals: {
    billed: number;
    collected: number;
    outstanding: number;
    settled: number;
    collectionRate: number;
  };
}

export const VOLUME_MONTH_OPTIONS = [6, 12, 24] as const;

export function useMetricsVolume(months: number) {
  return useQuery({
    queryKey: ["admin", "metrics", "volume", months],
    queryFn: () => api.get<VolumeReport>(`/v1/admin/metrics/volume${buildQuery({ months })}`),
  });
}
