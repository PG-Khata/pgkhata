import { db, messageDelivery, bill, tenant, room, property } from "@pgkhata/db";
import type {
  MessageChannel,
  MessageDeliveryStatus,
  MessageKind,
  MessageProvider,
} from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { billReadyEmail, formatCurrency, sendEmail } from "@pgkhata/email";
import { isWhatsAppConfigured, sendBillNotification } from "./whatsapp";
import { logger } from "./logger";
import { setAuthDeliveryRecorder } from "@pgkhata/auth";

/**
 * Every outbound message the platform sends, and the one place that records it.
 *
 * This lives outside the route files on purpose. `deliverBill` was reachable
 * only from `routes/billing.ts`, so it was the only send path in the product
 * that left any trace; WhatsApp reminders and auth emails left none at all,
 * which is why "did the tenant get the bill?" and "I never got the OTP" were
 * unanswerable. Moving the sender here makes the log a property of *sending*
 * rather than a property of one router.
 */

/**
 * Hard ceiling on a single bulk-reminder request.
 *
 * WhatsApp template messages are billed per conversation by Meta, so an
 * unbounded loop over unpaid bills is an unbounded charge on a single HTTP
 * request — and the owner who fat-fingers it twice pays twice. The number
 * lives next to the sender rather than in the route because it is a fact about
 * what messaging costs, not about one endpoint.
 *
 * Sized to clear any real property in one run: a house with more than this many
 * unpaid bills has a data problem, not a reminder problem, and the operator
 * should see the cap rather than the invoice.
 */
export const MAX_BULK_REMINDERS = 200;

/**
 * The provider each channel is served by today. Callers may override — a
 * second email vendor would land as a per-call `provider` without touching
 * this default.
 */
const DEFAULT_PROVIDER: Record<MessageChannel, MessageProvider> = {
  email: "resend",
  whatsapp: "meta",
};

/**
 * Template identifiers used by the bill path. WhatsApp's names are Meta's
 * registered template names (see `lib/whatsapp.ts`); the email one names the
 * React template in `@pgkhata/email`.
 */
const BILL_EMAIL_TEMPLATE = "bill_ready";
const BILL_WHATSAPP_TEMPLATE = "monthly_bill_ready";

/**
 * One attempted send, as recorded.
 *
 * Deliberately wide enough for every path that will call it: a WhatsApp
 * template send carrying a provider message id and a billable unit, a plain
 * email, a failure with its error string, and a send that never happened at
 * all (`status: "skipped"` with the reason in `error`).
 */
export interface DeliveryRecord {
  /**
   * Null only when there is genuinely no property yet — an OTP or password
   * reset is sent before the recipient owns anything. Owner-directed mail for
   * an existing account should still name a property where one is in scope.
   */
  propertyId?: string | null;
  tenantId?: string | null;
  billId?: string | null;
  /** Raw address; normalised on the way in, so callers need not pre-clean it. */
  recipient: string | null | undefined;
  channel: MessageChannel;
  kind: MessageKind;
  /** Provider template name, or the email template identifier. */
  template?: string | null;
  status: MessageDeliveryStatus;
  /** The failure message, or the reason a send was deliberately skipped. */
  error?: string | null;
  /** Defaults from `channel`. */
  provider?: MessageProvider | null;
  providerMessageId?: string | null;
  /**
   * Billable units. Defaults to 1 for a WhatsApp message that actually left
   * the building and 0 for everything else, which is the right answer for
   * every caller today; pass it explicitly only when the provider charges
   * differently (a multi-message send, or a free service conversation).
   */
  costUnits?: number;
}

/**
 * The address as it went on the wire, so the log survives the tenant later
 * editing their profile.
 *
 * Phones are stored with the country code because that is what Meta is given
 * (`lib/whatsapp.ts` dials `91${phone}`); a bare ten-digit number in the log
 * would not match the number in a provider's own records.
 */
export function normaliseRecipient(
  channel: MessageChannel,
  recipient: string | null | undefined,
): string {
  const value = (recipient ?? "").trim();
  if (channel === "email") return value.toLowerCase();
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Only a message that actually reached the provider can have cost anything. */
function defaultCostUnits(channel: MessageChannel, status: MessageDeliveryStatus): number {
  return channel === "whatsapp" && status === "sent" ? 1 : 0;
}

/**
 * The single writer for `message_delivery`. Every send path goes through here.
 *
 * Never throws and never rejects. A delivery log is observability, and
 * observability that can take down the thing it observes is worse than no
 * observability at all — the tenant's bill must go out even if the row
 * recording it cannot be written. Failures are swallowed into a loud
 * `logger.error`, the same bargain `middleware/audit.ts` makes; alert on it.
 *
 * Callers may `await` this (it is safe, and gives tests a join point) or fire
 * it with `void` on a latency-sensitive path.
 */
export async function recordDelivery(entry: DeliveryRecord): Promise<void> {
  try {
    await db.insert(messageDelivery).values({
      propertyId: entry.propertyId ?? null,
      tenantId: entry.tenantId ?? null,
      billId: entry.billId ?? null,
      recipient: normaliseRecipient(entry.channel, entry.recipient),
      channel: entry.channel,
      kind: entry.kind,
      template: entry.template ?? null,
      status: entry.status,
      error: entry.error ?? null,
      provider: entry.provider ?? DEFAULT_PROVIDER[entry.channel],
      providerMessageId: entry.providerMessageId ?? null,
      costUnits: entry.costUnits ?? defaultCostUnits(entry.channel, entry.status),
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        channel: entry.channel,
        kind: entry.kind,
        status: entry.status,
        propertyId: entry.propertyId ?? null,
      },
      "DELIVERY LOG WRITE FAILED",
    );
  }
}

export function publicInvoiceUrl(token: string) {
  return `${process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || ""}/invoice/${token}`;
}

export async function ownedBillWithDetails(propertyId: string, billId: string) {
  const [row] = await db.select({ bill: bill, tenant: tenant, roomNumber: room.number, propertyName: property.name, upiId: property.upiVpa })
    .from(bill).innerJoin(tenant, eq(bill.tenantId, tenant.id)).leftJoin(room, eq(tenant.roomId, room.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(eq(bill.id, billId), eq(tenant.propertyId, propertyId))).limit(1);
  return row;
}

export type OwnedBillWithDetails = NonNullable<Awaited<ReturnType<typeof ownedBillWithDetails>>>;

export function billAmounts(row: OwnedBillWithDetails) {
  const lines = row.bill.lineItems as { code: string; amount: number }[];
  const rentAmount = lines.find((line) => line.code === "RENT")?.amount ?? 0;
  const electricityAmount = lines.find((line) => line.code === "ELEC")?.amount ?? 0;
  return { rentAmount, electricityAmount, otherCharges: row.bill.totalAmount - rentAmount - electricityAmount };
}

export function shareMessage(row: OwnedBillWithDetails) {
  const { rentAmount, electricityAmount, otherCharges } = billAmounts(row);
  return `Hi ${row.tenant.name}, your ${row.bill.billMonth} bill for ${row.propertyName} Room ${row.roomNumber || "—"} is ready.\n\nRent: ${formatCurrency(rentAmount)}\nElectricity: ${formatCurrency(electricityAmount)}\nOther charges: ${formatCurrency(otherCharges)}\n------------------\nTotal due: ${formatCurrency(row.bill.totalAmount)}\n\nDue by ${row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "—"}. Pay by UPI to ${row.upiId || "the property owner"}.\n\nSave this message as your bill receipt.`;
}

/**
 * Send one bill on each requested channel, and record every outcome.
 *
 * A partial failure is a normal result, not an error: email may be unconfigured
 * while WhatsApp succeeds, so each channel is attempted independently and the
 * per-channel outcome is returned for the owner UI to show.
 *
 * The row now lands in `message_delivery` rather than `bill_delivery`. Nothing
 * read `bill_delivery` — it was write-only — and migration 0030 copies its
 * history forward, so the table stays in place as the historical record while
 * every new send joins the one log that also covers reminders and auth mail.
 */
export async function deliverBill(row: OwnedBillWithDetails, channels: Array<"email" | "whatsapp">, kind: "bill" | "reminder" = "bill") {
  const results: Array<{ channel: string; status: string; reason?: string }> = [];
  for (const channel of channels) {
    let status: MessageDeliveryStatus = "sent"; let reason: string | undefined; let providerMessageId: string | undefined;
    try {
      if (channel === "email") {
        if (!row.tenant.email) { status = "skipped"; reason = "Tenant has no email address"; }
        else if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) { status = "skipped"; reason = "Email delivery is not configured"; }
        else {
          const amounts = billAmounts(row);
          const result = await sendEmail({ to: row.tenant.email, subject: `${kind === "reminder" ? "Payment reminder" : "Bill ready"} — ${row.propertyName}`, html: billReadyEmail({ tenantName: row.tenant.name, propertyName: row.propertyName, roomNumber: row.roomNumber || "—", month: row.bill.billMonth, rentAmount: formatCurrency(amounts.rentAmount), electricityAmount: formatCurrency(amounts.electricityAmount), otherCharges: formatCurrency(amounts.otherCharges), totalAmount: formatCurrency(row.bill.totalAmount), balance: formatCurrency(row.bill.balance), dueDate: row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "—", invoiceUrl: publicInvoiceUrl(row.bill.accessToken) }) });
          providerMessageId = result?.id;
        }
      } else if (!isWhatsAppConfigured()) { status = "skipped"; reason = "WhatsApp delivery is not configured"; }
      else {
        const amounts = billAmounts(row);
        const result = await sendBillNotification({ phone: row.tenant.phone, tenantName: row.tenant.name, propertyName: row.propertyName, roomNumber: row.roomNumber || "—", billMonth: row.bill.billMonth, ...amounts, totalAmount: row.bill.totalAmount, dueDate: row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "—", upiId: row.upiId || undefined });
        if (!result.success) { status = "failed"; reason = result.error; } else providerMessageId = result.messageId;
      }
    } catch (error) { status = "failed"; reason = error instanceof Error ? error.message : "Delivery failed"; }
    await recordDelivery({
      propertyId: row.tenant.propertyId,
      tenantId: row.tenant.id,
      billId: row.bill.id,
      recipient: channel === "email" ? row.tenant.email : row.tenant.phone,
      channel,
      kind,
      template: channel === "email" ? BILL_EMAIL_TEMPLATE : BILL_WHATSAPP_TEMPLATE,
      status,
      error: reason || null,
      providerMessageId: providerMessageId || null,
    });
    results.push({ channel, status, reason });
  }
  return results;
}

/**
 * Connect Better Auth's password-reset and OTP mail to the delivery log.
 *
 * `auth.ts` cannot import this file (`apps/api` depends on `@pgkhata/auth`,
 * never the reverse), so the write is injected here instead. This runs the
 * moment any route imports `delivery.ts`, which is startup, so "I never got the
 * OTP" stops being unanswerable. `AuthDeliveryRecord` is a structural subset of
 * `DeliveryRecord`, and `recordDelivery` already swallows its own failures, so
 * the recorder can never break an auth flow.
 */
setAuthDeliveryRecorder(recordDelivery);
