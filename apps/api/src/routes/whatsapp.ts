import { Router } from "express";
import { z } from "zod";
import { db, tenant, bill, room, property } from "@pgkhata/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import {
  sendBillNotification,
  sendPaymentReminder,
  sendRentDueReminder,
  isWhatsAppConfigured,
  isTemplateManagementConfigured,
  setupPGKhataTemplates,
  listTemplates,
} from "../lib/whatsapp";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOwner, requireProperty);

// Check WhatsApp configuration status
router.get("/status", async (req: AuthenticatedRequest, res) => {
  res.json({
    configured: isWhatsAppConfigured(),
    templateManagement: isTemplateManagementConfigured(),
  });
});

// List all WhatsApp templates
router.get("/templates", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await listTemplates();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// Setup all PGKhata templates (run once)
router.post("/setup-templates", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await setupPGKhataTemplates();
    res.json({
      message: result.success
        ? "All templates created successfully"
        : "Some templates failed to create",
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to setup templates" });
  }
});

// Send bill notification to a single tenant
router.post("/send-bill/:billId", async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");

    const [row] = await db
      .select({
        bill: bill,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        roomNumber: room.number,
        propertyName: property.name,
        upiId: property.signupToken, // Using signupToken as placeholder for UPI ID
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(and(eq(bill.id, billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Bill not found" });

    const lineItems = row.bill.lineItems as { code: string; name: string; amount: number }[];
    const rentAmount = lineItems.find((l) => l.code === "RENT")?.amount ?? 0;
    const electricityAmount = lineItems.find((l) => l.code === "ELEC")?.amount ?? 0;
    const otherCharges = row.bill.totalAmount - rentAmount - electricityAmount;

    const result = await sendBillNotification({
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

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

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

    const result = await sendPaymentReminder({
      phone: row.tenantPhone,
      tenantName: row.tenantName,
      propertyName: row.propertyName,
      roomNumber: row.roomNumber || "N/A",
      billMonth: unpaidBill.billMonth,
      amount: unpaidBill.balance,
      dueDate: unpaidBill.dueDate ? new Date(unpaidBill.dueDate).toLocaleDateString("en-IN") : "N/A",
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ message: "Payment reminder sent", messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to send payment reminder" });
  }
});

// Send bulk payment reminders to all tenants with unpaid bills
router.post("/send-bulk-reminders", async (req: AuthenticatedRequest, res) => {
  try {
    const unpaidBills = await db
      .select({
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
      .where(and(eq(tenant.propertyId, req.propertyId!), sql`${bill.balance} > 0`));

    if (unpaidBills.length === 0) {
      return res.json({ message: "No unpaid bills", sent: 0, failed: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const row of unpaidBills) {
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
        sent++;
      } else {
        failed++;
      }
    }

    res.json({
      message: `Sent ${sent} reminders, ${failed} failed`,
      sent,
      failed,
      total: unpaidBills.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send bulk reminders" });
  }
});

export default router;
