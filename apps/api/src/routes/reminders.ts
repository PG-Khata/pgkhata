import { Router } from "express";
import { z } from "zod";
import { db, bill, tenant, room, property } from "@pgkhata/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { deliverBill } from "../lib/delivery";

const router = Router({ mergeParams: true });

const sendReminderSchema = z.object({
  billIds: z.array(z.string().uuid()).min(1).max(100),
  channel: z.enum(["email", "whatsapp", "both"]).default("email"),
});

router.use(requireAuth, requireOwner, requireProperty);

/**
 * Send reminders for a set of bills.
 *
 * This used to carry its own email block and a `not_implemented` stub for
 * WhatsApp, which meant two divergent renderings of the same message and one
 * channel that silently did nothing. Both are gone: delivery goes through
 * `deliverBill`, the same path `POST /bills/:billId/deliver` uses, so WhatsApp
 * genuinely sends and every attempt — sent, failed or skipped — lands in the
 * delivery log via `recordDelivery`.
 */
router.post("/send", async (req: AuthenticatedRequest, res) => {
  try {
    const { billIds, channel } = sendReminderSchema.parse(req.body);

    // Same row shape `deliverBill` is built against: the bill, its tenant, and
    // the property fields the templates render.
    const billsToSend = await db
      .select({
        bill: bill,
        tenant: tenant,
        roomNumber: room.number,
        propertyName: property.name,
        upiId: property.upiVpa,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .innerJoin(property, eq(tenant.propertyId, property.id))
      .where(
        and(
          inArray(bill.id, billIds),
          eq(tenant.propertyId, req.propertyId!),
          // A voided bill is not owed, so chasing it is always wrong. The
          // single-bill deliver route already refuses one; this route did not.
          isNull(bill.voidedAt),
        ),
      );

    const channels: Array<"email" | "whatsapp"> =
      channel === "both" ? ["email", "whatsapp"] : [channel];

    const results = [];

    for (const row of billsToSend) {
      const outcomes = await deliverBill(row, channels, "reminder");
      for (const outcome of outcomes) {
        results.push({
          billId: row.bill.id,
          tenantId: row.tenant.id,
          tenantName: row.tenant.name,
          channel: outcome.channel,
          status: outcome.status,
          ...(outcome.reason ? { reason: outcome.reason } : {}),
        });
      }
    }

    res.json({
      message: `Processed ${results.length} reminders`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

export default router;
