"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "@/lib/api-client";

export const DELIVERIES_PAGE_SIZE = 50;

/**
 * How many failed rows the failures feed pulls in one request before grouping
 * them client-side.
 *
 * Pinned to the API's own `MAX_PAGE_SIZE`, not to a bigger number we would like
 * — `pagination()` silently clamps anything larger, so asking for 500 and
 * captioning the panel "500 most recent" would be a lie told by the client.
 *
 * There is no server-side "group my failures" endpoint, so the grouping is only
 * ever as complete as this sample, and the panel says so. "One row of 400" is
 * only honest if we actually held 400 rows.
 */
export const FAILURE_SAMPLE_SIZE = 100;

export type DeliveryStatus = "queued" | "sent" | "failed" | "skipped";
export type DeliveryChannel = "email" | "whatsapp";
export type DeliveryKind =
  | "bill"
  | "reminder"
  | "otp"
  | "password_reset"
  | "onboarding"
  | "complaint_ack";

export const DELIVERY_STATUSES: DeliveryStatus[] = ["queued", "sent", "failed", "skipped"];
export const DELIVERY_CHANNELS: DeliveryChannel[] = ["email", "whatsapp"];

/**
 * The wire shape. `message_delivery` carries no owner column — nothing does
 * except `property.owner_id` — so the API resolves the owner by joining
 * through the property and returns it beside the row rather than inside it.
 */
interface DeliveryApiRow {
  delivery: {
    id: string;
    propertyId: string | null;
    tenantId: string | null;
    billId: string | null;
    recipient: string;
    channel: string;
    kind: string;
    template: string | null;
    status: string;
    error: string | null;
    provider: string | null;
    providerMessageId: string | null;
    costUnits: number;
    createdAt: string;
  };
  /** Null for platform messages — an OTP or password reset has no owner. */
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  propertyName: string | null;
}

/** A delivery, flattened for rendering. */
export interface DeliveryRow {
  id: string;
  propertyId: string | null;
  tenantId: string | null;
  billId: string | null;
  recipient: string;
  channel: DeliveryChannel | string;
  kind: DeliveryKind | string;
  template: string | null;
  status: DeliveryStatus | string;
  error: string | null;
  provider: string | null;
  providerMessageId: string | null;
  /** 1 per WhatsApp template message that left the building, 0 for email. */
  costUnits: number;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  propertyName: string | null;
}

function flatten(row: DeliveryApiRow): DeliveryRow {
  return {
    ...row.delivery,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    propertyName: row.propertyName,
  };
}

export interface DeliveryFilters {
  status?: DeliveryStatus;
  channel?: DeliveryChannel;
  ownerId?: string;
  /** ISO timestamp. The endpoint takes a lower bound only. */
  since?: string;
  page?: number;
  pageSize?: number;
}

async function fetchDeliveries(filters: DeliveryFilters) {
  const page = await api.getPage<DeliveryApiRow>(`/v1/admin/deliveries${buildQuery({ ...filters })}`);
  // The page metadata is preserved so `AdminPagination` still gets an
  // `ApiPage`; only the rows are reshaped.
  return { ...page, rows: page.rows.map(flatten) };
}

/** One page of the raw delivery feed. */
export function useDeliveries(filters: DeliveryFilters = {}) {
  return useQuery({
    queryKey: ["admin", "comms", "deliveries", filters],
    queryFn: () => fetchDeliveries(filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * The failures feed. Deliberately a separate query from {@link useDeliveries}
 * so that paging the raw feed never disturbs the grouped view, and so the
 * feed's status filter cannot silently empty the failures panel.
 */
export function useFailedDeliveries(
  filters: Omit<DeliveryFilters, "status" | "page" | "pageSize">,
) {
  const query: DeliveryFilters = {
    ...filters,
    status: "failed",
    page: 1,
    pageSize: FAILURE_SAMPLE_SIZE,
  };
  return useQuery({
    queryKey: ["admin", "comms", "deliveries", "failed", query],
    queryFn: () => fetchDeliveries(query),
    placeholderData: keepPreviousData,
  });
}

export type SummaryGroupBy = "owner" | "property" | "channel" | "day";

/**
 * One group from `GET /deliveries/summary`.
 *
 * `key` and `label` are null for the platform's own traffic — OTPs and password
 * resets belong to no owner and no property. That is a real and interesting
 * row, not a defect, so it is rendered rather than dropped.
 */
export interface DeliverySummaryRow {
  key: string | null;
  label: string | null;
  messages: number;
  failed: number;
  costUnits: number;
}

export interface DeliverySummaryResponse {
  groupBy: SummaryGroupBy;
  rows: DeliverySummaryRow[];
}

/**
 * `GET /v1/admin/deliveries/summary`.
 *
 * Takes the same filters as the feed, so the cost panel answers for exactly the
 * window and channel the page is showing rather than for some other one.
 */
export function useDeliverySummary(
  groupBy: SummaryGroupBy,
  filters: Omit<DeliveryFilters, "page" | "pageSize"> = {},
) {
  return useQuery({
    queryKey: ["admin", "comms", "deliveries", "summary", groupBy, filters],
    queryFn: () =>
      api.get<DeliverySummaryResponse>(
        `/v1/admin/deliveries/summary${buildQuery({ ...filters, groupBy })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export type TemplateApproval = "approved" | "rejected" | "pending" | "other";

/**
 * Exactly the four fields the API projects out of Meta's Graph response. It
 * does not forward a rejection reason or a language, so neither is shown —
 * inventing a "reason unavailable" column would imply we asked and were
 * refused.
 */
export interface WhatsappTemplateRaw {
  id: string;
  name: string;
  status: string;
  category: string;
}

export interface WhatsappTemplate extends WhatsappTemplateRaw {
  approval: TemplateApproval;
}

/**
 * Meta reports more states than approved / rejected / pending — PAUSED,
 * DISABLED, IN_APPEAL, PENDING_DELETION. Anything unrecognised stays `other`
 * and keeps its raw label on screen rather than being rounded into a bucket it
 * does not belong to.
 */
function toApproval(status: string | null | undefined): TemplateApproval {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "APPROVED") return "approved";
  if (value === "REJECTED") return "rejected";
  if (value === "PENDING" || value === "PENDING_REVIEW" || value === "IN_APPEAL") return "pending";
  return "other";
}

/**
 * `GET /v1/admin/whatsapp/templates`.
 *
 * 503 when template management is unconfigured, 502 when Meta itself refused.
 * Both surface as errors carrying the API's message, because "no templates"
 * and "we could not ask" are different facts.
 */
export function useWhatsappTemplates() {
  return useQuery({
    queryKey: ["admin", "comms", "whatsapp", "templates"],
    queryFn: async () => {
      const rows = await api.get<WhatsappTemplateRaw[]>("/v1/admin/whatsapp/templates");
      return (rows ?? []).map(
        (row): WhatsappTemplate => ({ ...row, approval: toApproval(row.status) }),
      );
    },
  });
}

/**
 * The sync result. `success` can be `false` on a `200`: Meta accepts some
 * templates and rejects others, so this is a per-template report rather than a
 * single outcome, and the caller must read `results` before claiming success.
 */
export interface TemplateSyncResult {
  message: string;
  success: boolean;
  results: Array<{ name: string; success: boolean; error?: string }>;
}

/**
 * `POST /v1/admin/whatsapp/setup-templates`. Super admin only — the button is
 * hidden for support, but the API is what actually enforces it.
 */
export function useSyncWhatsappTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<TemplateSyncResult>("/v1/admin/whatsapp/setup-templates"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "comms", "whatsapp", "templates"] });
    },
  });
}
