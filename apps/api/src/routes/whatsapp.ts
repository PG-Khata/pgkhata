import { Router } from "express";
import { db, tenant, bill, room, property } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import {
  sendBillNotification,
  sendPaymentReminder,
  isWhatsAppConfigured,
  isTemplateManagementConfigured,
} from "../lib/whatsapp";
import { recordDelivery, MAX_BULK_REMINDERS } from "../lib/delivery";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

/**
 * Meta's registered template names for the two sends in this file. They are
 * recorded with each delivery so a cost report can tell a bill from a reminder
 * without inferring it from `kind`.
 */
const BILL_TEMPLATE = "monthly_bill_ready";
const REMINDER_TEMPLATE = "rent_payment_reminder";

const NOT_CONFIGURED = "WhatsApp delivery is not configured";

/*
 * `costUnits` is deliberately never passed below. `recordDelivery` defaults it
 * to 1 for a WhatsApp message that actually reached Meta and 0 for anything
 * failed or skipped, which is exactly right here — only a message the provider
 * accepted is billable. Passing it by hand would mean three call sites that can
 * drift from what messaging really costs.
 */

// Check WhatsApp configuration status
router.get("/status", async (req: AuthenticatedRequest, res) => {
  res.json({
    configured: isWhatsAppConfigured(),
    templateManagement: isTemplateManagementConfigured(),
  });
});

/**
 * Template listing and creation used to live here, owner-scoped. They are gone:
 * a WhatsApp template is a single Meta WABA asset shared by every owner on the
 * platform, so an owner calling setup-templates was mutating the platform's own
 * Meta account. They now live at /v1/admin/whatsapp/* — see routes/admin/comms.ts.
 */

// Send bill notification to a single tenant
router.post("/send-bill/:billId", async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");

    const [row] = await db
      .select({
        bill: bill,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        roomNumber: room.number,
        propertyName: property.name,
        upiId: property.upiVpa,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(and(eq(bill.id, billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Bill not found" });

    // Shared by every outcome below, so the logged row differs only in status.
    const entry = {
      propertyId: req.propertyId!,
      tenantId: row.tenantId,
      billId: row.bill.id,
      recipient: row.tenantPhone,
      channel: "whatsapp" as const,
      kind: "bill" as const,
      template: BILL_TEMPLATE,
    };

    if (!isWhatsAppConfigured()) {
      await recordDelivery({ ...entry, status: "skipped", error: NOT_CONFIGURED });
      return res.status(503).json({ error: NOT_CONFIGURED });
    }

    const lineItems = row.bill.lineItems as { code: string; name: string; amount: number }[];
    const rentAmount = lineItems.find((l) => l.code === "RENT")?.amount ?? 0;
    const electricityAmount = lineItems.find((l) => l.code === "ELEC")?.amount ?? 0;
    const otherCharges = row.bill.totalAmount - rentAmount - electricityAmount;

    let result;
    try {
      result = await sendBillNotification({
        phone: row.tenantPhone,
        tenantName: row.tenantName,
        propertyName: row.propertyName,
        roomNumber: row.roomNumber || "N/A",
        billMonth: row.bill.billMonth,
        rentAmount,
        electricityAmount,
        otherCharges,
        totalAmount: row.bill.totalAmount,
        dueDate: row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "N/A",
        upiId: row.upiId || undefined,
      });
    } catch (error) {
      // A throw here (network, malformed provider response) is still a send the
      // owner may be asked about later, so it is logged like any other failure.
      await recordDelivery({
        ...entry,
        status: "failed",
        error: error instanceof Error ? error.message : "Send failed",
      });
      throw error;
    }

    if (!result.success) {
      await recordDelivery({ ...entry, status: "failed", error: result.error });
      return res.status(500).json({ error: result.error });
    }

    await recordDelivery({ ...entry, status: "sent", providerMessageId: result.messageId });

    res.json({ message: "Bill notification sent", messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to send bill notification" });
  }
});

// Send payment reminder to a single tenant
router.post("/send-reminder/:tenantId", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = param(req, "tenantId");

    const [row] = await db
      .select({
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        roomNumber: room.number,
        propertyName: property.name,
      })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Tenant not found" });

    // Get the latest unpaid bill
    const [unpaidBill] = await db
      .select()
      .from(bill)
      .where(and(eq(bill.tenantId, tenantId), sql`${bill.balance} > 0`))
      .orderBy(bill.billMonth)
      .limit(1);

    if (!unpaidBill) {
      return res.status(409).json({ error: "No unpaid bills for this tenant" });
    }

    const entry = {
      propertyId: req.propertyId!,
      tenantId,
      billId: unpaidBill.id,
      recipient: row.tenantPhone,
      channel: "whatsapp" as const,
      kind: "reminder" as const,
      template: REMINDER_TEMPLATE,
    };

    if (!isWhatsAppConfigured()) {
      await recordDelivery({ ...entry, status: "skipped", error: NOT_CONFIGURED });
      return res.status(503).json({ error: NOT_CONFIGURED });
    }

    let result;
    try {
      result = await sendPaymentReminder({
        phone: row.tenantPhone,
        tenantName: row.tenantName,
        propertyName: row.propertyName,
        roomNumber: row.roomNumber || "N/A",
        billMonth: unpaidBill.billMonth,
        amount: unpaidBill.balance,
        dueDate: unpaidBill.dueDate
          ? new Date(unpaidBill.dueDate).toLocaleDateString("en-IN")
          : "N/A",
      });
    } catch (error) {
      await recordDelivery({
        ...entry,
        status: "failed",
        error: error instanceof Error ? error.message : "Send failed",
      });
      throw error;
    }

    if (!result.success) {
      await recordDelivery({ ...entry, status: "failed", error: result.error });
      return res.status(500).json({ error: result.error });
    }

    await recordDelivery({ ...entry, status: "sent", providerMessageId: result.messageId });

    res.json({ message: "Payment reminder sent", messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to send payment reminder" });
  }
});

/**
 * Send payment reminders to every tenant carrying an unpaid bill.
 *
 * Capped at MAX_BULK_REMINDERS. This used to select every unpaid bill in the
 * property and message all of them serially inside one request: at a few
 * hundred tenants that is a few hundred sequential billable calls to Meta, on a
 * request the proxy gave up on long before it finished, with no record of what
 * it cost. The cap truncates the run and the response says so, so the caller
 * sees the remainder instead of believing everyone was reminded.
 */
router.post("/send-bulk-reminders", async (req: AuthenticatedRequest, res) => {
  try {
    const scope = and(eq(tenant.propertyId, req.propertyId!), sql`${bill.balance} > 0`);

    // Counted separately so the response can report the exact remainder rather
    // than merely "there were more".
    const [counted] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(scope);
    const total = counted?.total ?? 0;

    if (total === 0) {
      return res.json({
        message: "No unpaid bills",
        sent: 0,
        failed: 0,
        skipped: 0,
        attempted: 0,
        total: 0,
        truncated: false,
        remaining: 0,
        cap: MAX_BULK_REMINDERS,
      });
    }

    const unpaidBills = await db
      .select({
        billId: bill.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        roomNumber: room.number,
        propertyName: property.name,
        billMonth: bill.billMonth,
        balance: bill.balance,
        dueDate: bill.dueDate,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(scope)
      // Oldest debt first, so a truncated run chases the tenants furthest
      // behind rather than an arbitrary slice of them.
      .orderBy(bill.billMonth)
      .limit(MAX_BULK_REMINDERS);

    const truncated = total > unpaidBills.length;
    const remaining = total - unpaidBills.length;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const configured = isWhatsAppConfigured();

    for (const row of unpaidBills) {
      const entry = {
        propertyId: req.propertyId!,
        tenantId: row.tenantId,
        billId: row.billId,
        recipient: row.tenantPhone,
        channel: "whatsapp" as const,
        kind: "reminder" as const,
        template: REMINDER_TEMPLATE,
      };

      if (!configured) {
        await recordDelivery({ ...entry, status: "skipped", error: NOT_CONFIGURED });
        skipped++;
        continue;
      }

      try {
        const result = await sendPaymentReminder({
          phone: row.tenantPhone,
          tenantName: row.tenantName,
          propertyName: row.propertyName,
          roomNumber: row.roomNumber || "N/A",
          billMonth: row.billMonth,
          amount: row.balance,
          dueDate: row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-IN") : "N/A",
        });

        if (result.success) {
          await recordDelivery({ ...entry, status: "sent", providerMessageId: result.messageId });
          sent++;
        } else {
          await recordDelivery({ ...entry, status: "failed", error: result.error });
          failed++;
        }
      } catch (error) {
        // One bad phone number must not abandon the rest of the run.
        await recordDelivery({
          ...entry,
          status: "failed",
          error: error instanceof Error ? error.message : "Send failed",
        });
        failed++;
      }
    }

    res.json({
      message: truncated
        ? `Sent ${sent} reminders, ${failed} failed. Capped at ${MAX_BULK_REMINDERS} per run, so ${remaining} unpaid bills were not contacted — run it again to continue.`
        : `Sent ${sent} reminders, ${failed} failed`,
      sent,
      failed,
      skipped,
      attempted: unpaidBills.length,
      total,
      truncated,
      remaining,
      cap: MAX_BULK_REMINDERS,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send bulk reminders" });
  }
});

export default router;
