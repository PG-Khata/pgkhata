import { Router } from "express";
import { z } from "zod";
import { db, bill, tenant, property } from "@pgkhata/db";
import { eq, and, sql } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { sendEmail, billReminderEmail } from "../lib/email";
import { formatCurrency } from "../lib/format";

const router = Router({ mergeParams: true });

const sendReminderSchema = z.object({
  billIds: z.array(z.string().uuid()),
  channel: z.enum(["email", "whatsapp", "both"]).default("email"),
});

async function verifyPropertyOwnership(req: AuthenticatedRequest, res: any, next: any) {
  const [prop] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, req.params.propertyId), eq(property.ownerId, req.ownerId!)))
    .limit(1);
  if (!prop) return res.status(404).json({ error: "Property not found" });
  next();
}

// Send reminders for bills
router.post("/send", requireAuth, requireOwner, verifyPropertyOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const { billIds, channel } = sendReminderSchema.parse(req.body);

    // Get bills with tenant info
    const billsToSend = await db
      .select({
        bill: bill,
        tenant: tenant,
      })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(
        sql`${bill.id} = ANY(${billIds})`,
        eq(tenant.propertyId, req.params.propertyId)
      ));

    // Get property name
    const [prop] = await db
      .select()
      .from(property)
      .where(eq(property.id, req.params.propertyId))
      .limit(1);

    const results = [];

    for (const { bill: b, tenant: t } of billsToSend) {
      if (!t) continue;

      if (channel === "email" || channel === "both") {
        if (t.email) {
          try {
            await sendEmail({
              to: t.email,
              subject: `Payment reminder — ${prop?.name || "Your PG"}`,
              html: billReminderEmail({
                tenantName: t.name,
                propertyName: prop?.name || "Your PG",
                month: b.billMonth,
                totalAmount: formatCurrency(b.totalAmount),
                balance: formatCurrency(b.balance),
              }),
            });
            results.push({
              billId: b.id,
              tenantId: t.id,
              tenantName: t.name,
              channel: "email",
              status: "sent",
            });
          } catch {
            results.push({
              billId: b.id,
              tenantId: t.id,
              tenantName: t.name,
              channel: "email",
              status: "failed",
            });
          }
        } else {
          results.push({
            billId: b.id,
            tenantId: t.id,
            tenantName: t.name,
            channel: "email",
            status: "skipped",
            reason: "No email on file",
          });
        }
      }

      // TODO: Integrate with Meta WhatsApp Cloud API
      if (channel === "whatsapp" || channel === "both") {
        results.push({
          billId: b.id,
          tenantId: t.id,
          tenantName: t.name,
          channel: "whatsapp",
          status: "not_implemented",
        });
      }
    }

    res.json({
      message: `Processed ${results.length} reminders`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

export default router;
