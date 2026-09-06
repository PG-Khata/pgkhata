import { Router } from "express";
import { z } from "zod";
import {
  db,
  bill,
  tenant,
  room,
  bed,
  rentPlan,
  chargeType,
  electricityReading,
  payment,
  billDelivery,
  property,
} from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { calculateBill } from "../lib/billing-calculator";
import {
  occupiedDaysInReadingPeriod,
  readingForMonth,
  readingPairForMonth,
  rentProrationForMonth,
} from "../lib/electricity";
import { computeDueDate } from "../lib/due-date";
import { calculateLateFee } from "../lib/late-fee";
import { billReadyEmail, formatCurrency, sendEmail } from "@pgkhata/email";
import { isWhatsAppConfigured, sendBillNotification } from "../lib/whatsapp";

const router = Router({ mergeParams: true });

const generateBillsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
  tenantId: z.string().uuid().optional(),
});

const applyLateFeesSchema = z.object({
  billIds: z.array(z.string().uuid()).optional(),
  asOf: z.string().optional(),
});
const deliverySchema = z.object({ channels: z.array(z.enum(["email", "whatsapp"])).min(1) });

function publicInvoiceUrl(token: string) {
  return `${process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || ""}/invoice/${token}`;
}

function billAmounts(row: NonNullable<Awaited<ReturnType<typeof ownedBillWithDetails>>>) {
  const lines = row.bill.lineItems as { code: string; amount: number }[];
  const rentAmount = lines.find((line) => line.code === "RENT")?.amount ?? 0;
  const electricityAmount = lines.find((line) => line.code === "ELEC")?.amount ?? 0;
  return { rentAmount, electricityAmount, otherCharges: row.bill.totalAmount - rentAmount - electricityAmount };
}

function shareMessage(row: NonNullable<Awaited<ReturnType<typeof ownedBillWithDetails>>>) {
  const { rentAmount, electricityAmount, otherCharges } = billAmounts(row);
  return `Hi ${row.tenant.name}, your ${row.bill.billMonth} bill for ${row.propertyName} Room ${row.roomNumber || "—"} is ready.\n\nRent: ${formatCurrency(rentAmount)}\nElectricity: ${formatCurrency(electricityAmount)}\nOther charges: ${formatCurrency(otherCharges)}\n------------------\nTotal due: ${formatCurrency(row.bill.totalAmount)}\n\nDue by ${row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "—"}. Pay by UPI to ${row.upiId || "the property owner"}.\n\nSave this message as your bill receipt.`;
}

async function ownedBillWithDetails(propertyId: string, billId: string) {
  const [row] = await db.select({ bill: bill, tenant: tenant, roomNumber: room.number, propertyName: property.name, upiId: property.upiVpa })
    .from(bill).innerJoin(tenant, eq(bill.tenantId, tenant.id)).leftJoin(room, eq(tenant.roomId, room.id))
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(and(eq(bill.id, billId), eq(tenant.propertyId, propertyId))).limit(1);
  return row;
}

async function deliverBill(row: NonNullable<Awaited<ReturnType<typeof ownedBillWithDetails>>>, channels: Array<"email" | "whatsapp">, kind: "bill" | "reminder" = "bill") {
  const results: Array<{ channel: string; status: string; reason?: string }> = [];
  for (const channel of channels) {
    let status = "sent"; let reason: string | undefined; let providerMessageId: string | undefined;
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
    await db.insert(billDelivery).values({ billId: row.bill.id, channel, kind, status, error: reason || null, providerMessageId: providerMessageId || null });
    results.push({ channel, status, reason });
  }
  return results;
}

router.use(requireAuth, requireOwner, requireProperty);

async function missingMeterReadings(propertyId: string, month: string, tenantId?: string) {
  const active = await db.select({ tenant: tenant, room: room })
    .from(tenant).leftJoin(room, eq(tenant.roomId, room.id))
    .where(tenantId
      ? and(eq(tenant.propertyId, propertyId), eq(tenant.status, "active"), eq(tenant.id, tenantId))
      : and(eq(tenant.propertyId, propertyId), eq(tenant.status, "active")));
  const billable = active.filter((row) => row.room && rentProrationForMonth(row.tenant.joiningDate, month) > 0);
  const roomIds = [...new Set(billable.map((row) => row.room!.id))];
  if (!roomIds.length) return [];
  const all = await db.select({ roomId: electricityReading.roomId, reading: electricityReading.reading, readingDate: electricityReading.readingDate })
    .from(electricityReading).where(inArray(electricityReading.roomId, roomIds));
  return roomIds.flatMap((roomId) => {
    const readings = all.filter((r) => r.roomId === roomId);
    if (readingForMonth(readings, month)) return [];
    const occupants = billable.filter((row) => row.room!.id === roomId);
    const latest = readings.reduce<typeof readings[number] | undefined>((last, current) => !last || current.readingDate > last.readingDate ? current : last, undefined);
    return [{ roomId, roomNumber: occupants[0]!.room!.number, tenants: occupants.map((row) => ({ id: row.tenant.id, name: row.tenant.name })), latestReading: latest ? { reading: latest.reading, readingDate: latest.readingDate } : null }];
  });
}

// Preflight is intentionally public to the owner UI and repeated during
// generation below: the second check closes the race between review and save.
router.get("/preflight", async (req: AuthenticatedRequest, res) => {
  try {
    const { month, tenantId } = generateBillsSchema.parse(req.query);
    if (req.property!.electricityMode !== "meter") return res.json({ complete: true, missingRooms: [] });
    const missingRooms = await missingMeterReadings(req.propertyId!, month, tenantId);
    res.json({ complete: missingRooms.length === 0, missingRooms });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to check meter readings" });
  }
});

// Get bills for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const month = req.query.month as string | undefined;

    const where = month
      ? and(eq(tenant.propertyId, req.propertyId!), eq(bill.billMonth, month))
      : eq(tenant.propertyId, req.propertyId!);

    const bills = await db
      .select({
        bill: bill,
        tenantName: tenant.name,
        roomNumber: room.number,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .where(where);

    res.json(
      bills.map((row) => ({
        ...row.bill,
        tenantName: row.tenantName,
        roomNumber: row.roomNumber,
      })),
    );
  } catch (error) {
    console.error("[Billing] List error:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

router.get("/:billId", async (req: AuthenticatedRequest, res) => {
  try {
    const [row] = await db
      .select({
        bill: bill,
        tenantName: tenant.name,
        roomNumber: room.number,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .where(
        and(eq(bill.id, param(req, "billId")), eq(tenant.propertyId, req.propertyId!)),
      )
      .limit(1);

    if (!row) return res.status(404).json({ error: "Bill not found" });

    res.json({ ...row.bill, tenantName: row.tenantName, roomNumber: row.roomNumber });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});

router.get("/:billId/share-link", async (req: AuthenticatedRequest, res) => {
  const row = await ownedBillWithDetails(req.propertyId!, param(req, "billId"));
  if (!row) return res.status(404).json({ error: "Bill not found" });
  res.json({ url: publicInvoiceUrl(row.bill.accessToken), message: shareMessage(row) });
});

router.post("/:billId/deliver", async (req: AuthenticatedRequest, res) => {
  try {
    const { channels } = deliverySchema.parse(req.body);
    const row = await ownedBillWithDetails(req.propertyId!, param(req, "billId"));
    if (!row) return res.status(404).json({ error: "Bill not found" });
    const results = await deliverBill(row, channels);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to deliver bill" });
  }
});

// Generate monthly bills
router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const { month, tenantId } = generateBillsSchema.parse(req.body);
    const prop = req.property!;
    if (prop.electricityMode === "meter") {
      const missingRooms = await missingMeterReadings(req.propertyId!, month, tenantId);
      if (missingRooms.length) return res.status(409).json({ error: "Meter readings are required before billing", missingRooms });
    }

    // Everything this run needs, read once outside the transaction: active
    // tenants with their room, bed and rent plan, plus the property's active
    // recurring charge types (excluding electricity, which is always computed
    // from readings rather than a flat default).
    const tenantFilter = tenantId
      ? and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, "active"), eq(tenant.id, tenantId))
      : and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, "active"));

    const activeTenants = await db
      .select({ tenant: tenant, room: room, bed: bed, plan: rentPlan })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .leftJoin(rentPlan, eq(room.rentPlanId, rentPlan.id))
      .where(tenantFilter);

    const recurringCharges = await db
      .select({ code: chargeType.code, name: chargeType.name, amount: chargeType.defaultAmount })
      .from(chargeType)
      .where(
        and(
          eq(chargeType.propertyId, req.propertyId!),
          eq(chargeType.isRecurring, true),
          eq(chargeType.isActive, true),
          sql`${chargeType.code} <> 'ELEC'`,
        ),
      );

    const roomIds = [
      ...new Set(activeTenants.map((row) => row.room?.id).filter((id): id is string => Boolean(id))),
    ];

    const readingsByRoom = new Map<string, Array<{ readingDate: Date; reading: number }>>();
    if (roomIds.length > 0) {
      const readings = await db
        .select({
          roomId: electricityReading.roomId,
          readingDate: electricityReading.readingDate,
          reading: electricityReading.reading,
        })
        .from(electricityReading)
        .where(inArray(electricityReading.roomId, roomIds));

      for (const r of readings) {
        const bucket = readingsByRoom.get(r.roomId);
        if (bucket) bucket.push(r);
        else readingsByRoom.set(r.roomId, [r]);
      }
    }

    const tenantsByRoom = new Map<string, (typeof activeTenants)[number][]>();
    for (const row of activeTenants) {
      if (!row.room) continue;
      const occupants = tenantsByRoom.get(row.room.id);
      if (occupants) occupants.push(row);
      else tenantsByRoom.set(row.room.id, [row]);
    }

    // The whole run is one transaction: either every bill this month lands
    // together, or none do. A partial run previously left some tenants billed
    // and others not with no way to tell which had already happened.
    const issuedAt = new Date();
    const dueDate = computeDueDate(issuedAt);

    const { generatedBills, skipped } = await db.transaction(async (tx) => {
      const generatedBills: (typeof bill.$inferSelect)[] = [];
      let skipped = 0;

      for (const { tenant: t, room: r, bed: b, plan } of activeTenants) {
        if (!r) continue;

        // Do not create a historical bill for someone who had not moved in.
        // This also makes a late billing run safe: its result is anchored to
        // the requested month and tenant move-in date, never today's date.
        const rentProration = rentProrationForMonth(t.joiningDate, month);
        if (rentProration === 0) continue;

        // Electricity is defined by the first and second actual meter
        // readings, not by the date a bill happens to be generated. The
        // second (closing) reading belongs to the selected invoice month, so
        // an Aug 1 → Sep 2 pair correctly appears on September's bill.
        const readingPair = readingPairForMonth(
          readingsByRoom.get(r.id) ?? [],
          month,
        );
        const roomOccupants = tenantsByRoom.get(r.id) ?? [];
        const totalOccupancyDays = readingPair
          ? roomOccupants.reduce(
              (sum, occupant) =>
                sum +
                occupiedDaysInReadingPeriod(
                  occupant.tenant.joiningDate,
                  readingPair.first.readingDate,
                  readingPair.second.readingDate,
                ),
              0,
            )
          : 0;
        const tenantOccupancyDays = readingPair
          ? occupiedDaysInReadingPeriod(
              t.joiningDate,
              readingPair.first.readingDate,
              readingPair.second.readingDate,
            )
          : 0;

        const calculated = calculateBill({
          rent: {
            tenantOverride: t.monthlyRentOverride,
            bedRent: b?.monthlyRent,
            planRent: plan?.monthlyRent,
            roomRent: r.monthlyRent,
            proration: rentProration,
          },
          electricity: {
            ratePerUnit: prop.electricityRatePerUnit,
            unitsForMonth: readingPair?.units,
            occupants: roomOccupants.length || 1,
            occupancyShare: totalOccupancyDays > 0 ? tenantOccupancyDays / totalOccupancyDays : undefined,
          },
          recurringCharges,
        });

        // Check if a bill already exists for this tenant+month
        const [existingBill] = await tx
          .select({ id: bill.id, voidedAt: bill.voidedAt })
          .from(bill)
          .where(and(eq(bill.tenantId, t.id), eq(bill.billMonth, month)))
          .limit(1);

        if (existingBill) {
          if (existingBill.voidedAt) {
            // Voided bill exists — delete it so we can regenerate
            await tx.delete(bill).where(eq(bill.id, existingBill.id));
          } else {
            // Active bill already exists — skip
            skipped += 1;
            continue;
          }
        }

        const [newBill] = await tx
          .insert(bill)
          .values({
            tenantId: t.id,
            billMonth: month,
            rentAmount: calculated.rentAmount,
            electricityAmount: calculated.electricityAmount,
            lineItems: calculated.lineItems,
            totalAmount: calculated.totalAmount,
            balance: calculated.totalAmount,
            dueDate,
            createdAt: issuedAt,
            approved: false,
          })
          .returning();

        if (newBill) {
          generatedBills.push(newBill);
        } else {
          skipped += 1;
        }
      }

      return { generatedBills, skipped };
    });

    res.status(201).json({
      message: `Generated ${generatedBills.length} bills`,
      generated: generatedBills.length,
      skipped,
      bills: generatedBills,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate bills" });
  }
});

// Apply late fees to overdue, unpaid bills as a LATE line item.
// Idempotent per calendar day: re-running the same day updates the existing
// LATE line to the freshly computed amount rather than stacking a second one,
// so a retried or duplicated cron trigger cannot double-charge a tenant.
router.post("/apply-late-fees", async (req: AuthenticatedRequest, res) => {
  try {
    const body = applyLateFeesSchema.parse(req.body);
    const asOf = body.asOf ? new Date(body.asOf) : new Date();

    const targetBills = await db
      .select({
        bill: bill,
        plan: rentPlan,
      })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(rentPlan, eq(room.rentPlanId, rentPlan.id))
      .where(
        and(
          eq(tenant.propertyId, req.propertyId!),
          body.billIds ? inArray(bill.id, body.billIds) : sql`true`,
        ),
      );

    const updatedBills = await db.transaction(async (tx) => {
      const updated: (typeof bill.$inferSelect)[] = [];

      for (const { bill: b, plan } of targetBills) {
        const { amount, daysOverdue } = calculateLateFee({
          dueDate: b.dueDate,
          lateFeePerDay: plan?.lateFeePerDay,
          asOf,
          balance: b.balance,
          voidedAt: b.voidedAt,
          promisedDate: b.promisedDate,
        });

        const withoutLateFee = (b.lineItems as { code: string; name: string; amount: number }[]).filter(
          (line) => line.code !== "LATE",
        );

        if (amount <= 0) {
          // No longer overdue (paid, voided, or the date rolled back): if a
          // stale LATE line exists from a previous run, remove it too.
          if (withoutLateFee.length !== (b.lineItems as unknown[]).length) {
            const totalAmount = withoutLateFee.reduce((sum, line) => sum + line.amount, 0);
            const [row] = await tx
              .update(bill)
              .set({
                lineItems: withoutLateFee,
                totalAmount,
                balance: Math.max(0, totalAmount - b.paidAmount),
                updatedAt: new Date(),
              })
              .where(eq(bill.id, b.id))
              .returning();
            if (row) updated.push(row);
          }
          continue;
        }

        const lineItems = [
          ...withoutLateFee,
          { code: "LATE", name: `Late fee (${daysOverdue}d)`, amount },
        ];
        const totalAmount = lineItems.reduce((sum, line) => sum + line.amount, 0);

        const [row] = await tx
          .update(bill)
          .set({
            lineItems,
            totalAmount,
            balance: Math.max(0, totalAmount - b.paidAmount),
            updatedAt: new Date(),
          })
          .where(eq(bill.id, b.id))
          .returning();

        if (row) updated.push(row);
      }

      return updated;
    });

    res.json({
      message: `Updated late fees on ${updatedBills.length} bill${updatedBills.length === 1 ? "" : "s"}`,
      updated: updatedBills.length,
      bills: updatedBills,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to apply late fees" });
  }
});

// Set or clear a bill's promised payment date. Late fees are suspended until
// this date, giving the tenant time to pay without penalty.
router.patch("/:billId/promised-date", async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");
    const { promisedDate } = z
      .object({ promisedDate: z.string().nullable().optional() })
      .parse(req.body);

    const [target] = await db
      .select({ bill: bill })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(bill.id, billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Bill not found" });

    const [updated] = await db
      .update(bill)
      .set({
        promisedDate: promisedDate ? new Date(promisedDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(bill.id, billId))
      .returning();

    res.json({ message: promisedDate ? "Promised date set" : "Promised date cleared", bill: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update promised date" });
  }
});

// Void a bill — sets voidedAt, zeros balance, preserves the record for audit.
// Delete a bill permanently
router.delete("/:billId", async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");

    const [target] = await db
      .select({ bill: bill })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(bill.id, billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Bill not found" });

    // Delete associated payments and bill in a transaction
    await db.transaction(async (tx) => {
      await tx.delete(payment).where(eq(payment.billId, billId));
      await tx.delete(bill).where(eq(bill.id, billId));
    });

    res.json({ message: "Bill deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

// Approve bills — scoped to this property, not any billId the caller sends.
router.post("/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const { billIds } = z.object({ billIds: z.array(z.string().uuid()) }).parse(req.body);

    const approved = await db
      .update(bill)
      .set({ approved: true, updatedAt: new Date() })
      .where(
        and(
          inArray(bill.id, billIds),
          inArray(
            bill.tenantId,
            db.select({ id: tenant.id }).from(tenant).where(eq(tenant.propertyId, req.propertyId!)),
          ),
        ),
      )
      .returning();

    res.json({ message: `Approved ${approved.length} bills`, bills: approved });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to approve bills" });
  }
});

export default router;
