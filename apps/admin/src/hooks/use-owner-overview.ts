"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/**
 * Mirror of `GET /v1/admin/owners/:ownerId/overview`.
 *
 * This is the one request Owner 360 makes to answer a support call, so the
 * shape is written down here rather than inlined in the page: the page reads
 * it in a dozen places and a silent drift would show up as a blank card.
 *
 * Every numeric field is optional on purpose. The endpoint is still being
 * built, and a support console that renders `0` for "the server did not send
 * this" is worse than one that renders an em dash — an agent would read the
 * zero out loud to the owner. Nothing here defaults a missing number.
 */

export type OwnerAccountStatus = "active" | "suspended" | "pending_deletion" | "deleted";

export interface OwnerOverviewIdentity {
  ownerId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string | null;
  status: OwnerAccountStatus;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
}

/** Bed counts keyed by the schema's `bed.status` values. */
export interface OwnerOverviewBedCounts {
  total?: number;
  vacant?: number;
  occupied?: number;
  maintenance?: number;
}

export interface OwnerOverviewProperty {
  id: string;
  name: string;
  city?: string | null;
  beds?: OwnerOverviewBedCounts;
  /** 0-100. */
  occupancyRate?: number;
  activeTenants?: number;
  electricityMode?: string;
  /** False means tenants have no way to pay from the bill link. */
  hasUpiVpa?: boolean;
}

export interface OwnerOverviewAging {
  /** Outstanding that is not yet 30 days old. */
  current?: number;
  days30?: number;
  days60?: number;
  days90Plus?: number;
}

export interface OwnerOverviewBilling {
  /** `YYYY-MM` the current-month figures below describe. */
  month?: string;
  billed?: number;
  collected?: number;
  outstanding?: number;
  /** 0-100. */
  collectionRate?: number;
  aging?: OwnerOverviewAging;
  lastBillAt?: string | null;
  lastPaymentAt?: string | null;
}

export type OwnerChecklistStep =
  | "property"
  | "room"
  | "bed"
  | "tenant"
  | "first_bill"
  | "first_payment";

export interface OwnerChecklistItem {
  done: boolean;
  at?: string | null;
}

/** Setup order, which is also the order a stuck owner is stuck in. */
export type OwnerOverviewChecklist = Partial<Record<OwnerChecklistStep, OwnerChecklistItem>>;

export type OwnerRiskFlagCode =
  | "bills_outstanding_60d"
  | "occupied_bed_no_tenant"
  | "active_tenant_no_bed"
  | "no_billing_activity_45d";

export interface OwnerRiskFlag {
  code: OwnerRiskFlagCode | (string & {});
  /** Server-authored sentence. Preferred over any client-side wording. */
  label?: string;
  detail?: string;
  severity?: "high" | "medium" | "low";
  count?: number;
  amount?: number;
  /** Admin-app path to whatever the flag is about. */
  href?: string;
}

export interface OwnerOverview {
  identity: OwnerOverviewIdentity;
  portfolio?: OwnerOverviewProperty[];
  billing?: OwnerOverviewBilling;
  checklist?: OwnerOverviewChecklist;
  riskFlags?: OwnerRiskFlag[];
}

export function ownerOverviewKey(ownerId: string) {
  return ["admin", "owners", ownerId, "overview"] as const;
}

/**
 * Wire shape of GET /v1/admin/owners/:id/overview, as the API actually returns
 * it. Kept separate from the view model above because the two were designed
 * against each other and disagree on names: the API speaks in owner/portfolio/
 * activation, the page reads identity/checklist, and the aging buckets are a
 * labelled array server-side (`"0-30"`) versus named fields here.
 *
 * Adapting in one place beats bending either side: the server shape mirrors
 * `summarizeAging`, which the owner dashboard already depends on, and the view
 * model is what the tabs are written against.
 */
interface OverviewResponse {
  owner: {
    id: string;
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    suspendedAt: string | null;
    suspendedReason: string | null;
    profileCreatedAt: string | null;
    lastSeenAt: string | null;
  };
  portfolio?: {
    properties?: Array<{
      id: string;
      name: string;
      city?: string | null;
      electricityMode?: string;
      hasUpiVpa?: boolean;
      occupancyRate?: number;
      activeTenants?: number;
      totalBeds?: number;
      occupiedBeds?: number;
      vacantBeds?: number;
      maintenanceBeds?: number;
    }>;
  };
  billing?: {
    month?: string;
    billed?: number;
    collected?: number;
    outstanding?: number;
    collectionRate?: number;
    lastBillAt?: string | null;
    lastPaymentAt?: string | null;
    aging?: { buckets?: Array<{ bucket: string; total: number; count: number }> };
  };
  activation?: {
    steps?: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  };
  riskFlags?: Array<{
    code: string;
    severity?: "high" | "medium" | "low";
    count?: number;
    message?: string;
    sample?: Array<{ id: string; label: string; href: string }>;
  }>;
}

/** Server bucket labels -> the named fields the billing tab renders. */
const AGING_FIELD: Record<string, keyof OwnerOverviewAging> = {
  current: "current",
  "0-30": "days30",
  "31-60": "days60",
  "61-90": "days90Plus",
  "90+": "days90Plus",
};

/** Server activation keys -> checklist steps. `structure` is the room step. */
const STEP_KEY: Record<string, OwnerChecklistStep> = {
  property: "property",
  structure: "room",
  bed: "bed",
  tenant: "tenant",
  bill: "first_bill",
  payment: "first_payment",
};

function adaptOverview(raw: OverviewResponse): OwnerOverview {
  const aging: OwnerOverviewAging = {};
  for (const b of raw.billing?.aging?.buckets ?? []) {
    const field = AGING_FIELD[b.bucket];
    // 61-90 and 90+ both land in days90Plus, so accumulate rather than assign.
    if (field) aging[field] = (aging[field] ?? 0) + b.total;
  }

  const checklist: OwnerOverviewChecklist = {};
  for (const step of raw.activation?.steps ?? []) {
    const key = STEP_KEY[step.key];
    if (key) checklist[key] = { done: step.done, at: step.at };
  }

  return {
    identity: {
      ownerId: raw.owner.id,
      userId: raw.owner.userId,
      name: raw.owner.name,
      email: raw.owner.email,
      phone: raw.owner.phone,
      status: (raw.owner.status ?? "active") as OwnerAccountStatus,
      createdAt: raw.owner.profileCreatedAt,
      lastLoginAt: raw.owner.lastSeenAt,
      suspendedAt: raw.owner.suspendedAt,
      suspendedReason: raw.owner.suspendedReason,
    },
    portfolio: (raw.portfolio?.properties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      electricityMode: p.electricityMode,
      hasUpiVpa: p.hasUpiVpa,
      occupancyRate: p.occupancyRate,
      activeTenants: p.activeTenants,
      beds: {
        total: p.totalBeds,
        occupied: p.occupiedBeds,
        vacant: p.vacantBeds,
        maintenance: p.maintenanceBeds,
      },
    })),
    billing: raw.billing && {
      month: raw.billing.month,
      billed: raw.billing.billed,
      collected: raw.billing.collected,
      outstanding: raw.billing.outstanding,
      collectionRate: raw.billing.collectionRate,
      lastBillAt: raw.billing.lastBillAt,
      lastPaymentAt: raw.billing.lastPaymentAt,
      aging: Object.keys(aging).length > 0 ? aging : undefined,
    },
    checklist: Object.keys(checklist).length > 0 ? checklist : undefined,
    riskFlags: raw.riskFlags?.map((f) => ({
      code: f.code,
      // The server authors the sentence; never re-word it client-side.
      label: f.message,
      severity: f.severity,
      count: f.count,
      // A flag is only actionable if it links somewhere. The server returns up
      // to 5 examples; the first is the one click that answers the call.
      href: f.sample?.[0]?.href,
    })),
  };
}

export function useOwnerOverview(ownerId: string) {
  return useQuery({
    queryKey: ownerOverviewKey(ownerId),
    queryFn: async () =>
      adaptOverview(await api.get<OverviewResponse>(`/v1/admin/owners/${ownerId}/overview`)),
    enabled: !!ownerId,
    // An agent on a call is reading these numbers out loud; a minute-old
    // outstanding balance is fine, a re-fetch on every tab click is not.
    staleTime: 60_000,
  });
}

/**
 * Suspend and reactivate share an invalidation set because both change the
 * account status badge that the owners list and this page both render.
 */
function useOwnerLifecycleMutation<TVars>(
  ownerId: string,
  mutationFn: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ownerOverviewKey(ownerId) });
      qc.invalidateQueries({ queryKey: ["admin", "owners"] });
    },
  });
}

export const SUSPEND_REASON_MIN_LENGTH = 10;

export function useSuspendOwner(ownerId: string) {
  return useOwnerLifecycleMutation(ownerId, (reason: string) =>
    api.post(`/v1/admin/owners/${ownerId}/suspend`, { reason }),
  );
}

export function useReactivateOwner(ownerId: string) {
  return useOwnerLifecycleMutation(ownerId, (reason: string | undefined) =>
    api.post(`/v1/admin/owners/${ownerId}/reactivate`, reason ? { reason } : undefined),
  );
}
