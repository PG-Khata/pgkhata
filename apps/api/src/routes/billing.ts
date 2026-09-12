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
  billAdjustment,
  occupancyHistory,
} from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { calculateBill, type BillLineItem } from "../lib/billing-calculator";
import {
  occupiedDaysInReadingPeriod,
  allocateExactAmount,
  readingForMonth,
  readingPairForMonth,
  rentProrationForMonth,
} from "../lib/electricity";
import { computeDueDate, isOverdue } from "../lib/due-date";
import { calculateLateFee } from "../lib/late-fee";
import {
  deliverBill,
  ownedBillWithDetails,
  publicInvoiceUrl,
  shareMessage,
} from "../lib/delivery";
import { reconcileOverdueStatuses } from "../lib/bill-status";
import { pagination, sendPage } from "../lib/pagination";

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
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.issues });
    res.status(500).json({ error: "Failed to check meter readings" });
  }
});

// Get bills for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const page = pagination(req);
    await reconcileOverdueStatuses([req.propertyId!]);
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
      .where(where)
      .limit(page.limit)
      .offset(page.offset);

    sendPage(res, bills.map((row) => ({
        ...row.bill,
        tenantName: row.tenantName,
        roomNumber: row.roomNumber,
      })), page);
  } catch (error) {
    console.error("[Billing] List error:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

router.get("/:billId", async (req: AuthenticatedRequest, res) => {
  try {
    await reconcileOverdueStatuses([req.propertyId!]);
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
  if (!row || row.bill.voidedAt) return res.status(404).json({ error: "Bill not found" });
  res.json({ url: publicInvoiceUrl(row.bill.accessToken), message: shareMessage(row) });
});

router.post("/:billId/deliver", async (req: AuthenticatedRequest, res) => {
  try {
    const { channels } = deliverySchema.parse(req.body);
    const row = await ownedBillWithDetails(req.propertyId!, param(req, "billId"));
    if (!row) return res.status(404).json({ error: "Bill not found" });
    if (row.bill.voidedAt) return res.status(409).json({ error: "Voided bills cannot be delivered" });
    const results = await deliverBill(row, channels);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.issues });
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
    // Always load the full property cohort. A tenant-specific run still needs
    // every roommate in its denominator and may reconcile their earlier bill.
    const tenantFilter = and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, "active"));

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

    // Occupancy history retains roommates who have since vacated. The
    // electricity split denominator must include them: only active tenants get
    // a bill, but splitting a room's charge across *only* the survivors makes
    // them absorb a departed roommate's usage. The departed roommate's share is
    // computed and simply not billed (it was settled at their checkout).
    const occupancyByRoom = new Map<
      string,
      Array<{ tenantId: string; startedOn: Date; endedOn: Date | null }>
    >();
    if (roomIds.length > 0) {
      const periods = await db
        .select({
          tenantId: occupancyHistory.tenantId,
          roomId: occupancyHistory.roomId,
          startedOn: occupancyHistory.startedOn,
          endedOn: occupancyHistory.endedOn,
        })
        .from(occupancyHistory)
        .where(inArray(occupancyHistory.roomId, roomIds));
      for (const p of periods) {
        const bucket = occupancyByRoom.get(p.roomId);
        if (bucket) bucket.push(p);
        else occupancyByRoom.set(p.roomId, [p]);
      }
    }

    const electricityByTenant = new Map<string, number>();
    for (const roomId of roomIds) {
      const readingPair = readingPairForMonth(readingsByRoom.get(roomId) ?? [], month);
      const totalCharge = Math.round(
        Math.max(0, readingPair?.units ?? 0) * Math.max(0, prop.electricityRatePerUnit ?? 0),
      );

      const weightByTenant = new Map<string, number>();
      if (readingPair) {
        // Primary source: occupancy history (includes vacated roommates).
        for (const period of occupancyByRoom.get(roomId) ?? []) {
          const days = occupiedDaysInReadingPeriod(
            period.startedOn,
            readingPair.first.readingDate,
            readingPair.second.readingDate,
            period.endedOn,
          );
          if (days > 0) {
            weightByTenant.set(period.tenantId, (weightByTenant.get(period.tenantId) ?? 0) + days);
          }
        }
        // Fallback: any active occupant with no history row (e.g. legacy data
        // predating occupancy tracking) is still weighted from their tenant
        // dates, so they are never dropped from the split.
        for (const occupant of tenantsByRoom.get(roomId) ?? []) {
          if (weightByTenant.has(occupant.tenant.id)) continue;
          const days = occupiedDaysInReadingPeriod(
            occupant.tenant.joiningDate,
            readingPair.first.readingDate,
            readingPair.second.readingDate,
            occupant.tenant.vacatingDate,
          );
          if (days > 0) weightByTenant.set(occupant.tenant.id, days);
        }
      }

      const shares = [...weightByTenant].map(([key, weight]) => ({ key, weight }));
      for (const [tenantKey, amount] of allocateExactAmount(totalCharge, shares)) {
        electricityByTenant.set(tenantKey, amount);
      }
    }

    // The whole run is one transaction: either every bill this month lands
    // together, or none do. A partial run previously left some tenants billed
    // and others not with no way to tell which had already happened.
    const issuedAt = new Date();
    const { generatedBills, skipped } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${req.propertyId!}:${month}`}))`);
      const generatedBills: (typeof bill.$inferSelect)[] = [];
      let skipped = 0;

      for (const { tenant: t, room: r, bed: b, plan } of activeTenants) {
        if (!r) continue;
        const isRequestedTenant = !tenantId || tenantId === t.id;

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
            amountOverride: electricityByTenant.get(t.id) ?? 0,
          },
          recurringCharges,
        });

        // Check if a bill already exists for this tenant+month
        const existingBills = await tx
          .select({ bill })
          .from(bill)
          .where(and(eq(bill.tenantId, t.id), eq(bill.billMonth, month)))
          .orderBy(sql`${bill.revision} desc`);
        const existingBill = existingBills[0]?.bill;

        if (existingBill && !existingBill.voidedAt) {
          // Preserve line items the generator does not compute — the LATE fee
          // added by /apply-late-fees and any manually added charge. Rebuilding
          // the bill purely from `calculated` (rent + electricity + recurring)
          // would silently drop them and refund a late fee the tenant still owes.
          const existingLines = (existingBill.lineItems as BillLineItem[]) ?? [];
          const preservedLines = existingLines.filter(
            (line) => !calculated.lineItems.some((c) => c.code === line.code),
          );
          const mergedLineItems = [...calculated.lineItems, ...preservedLines];
          const mergedTotal = mergedLineItems.reduce((sum, line) => sum + line.amount, 0);

          const changed = existingBill.totalAmount !== mergedTotal
            || existingBill.electricityAmount !== calculated.electricityAmount;
          // Only reconcile when the new total still covers what the tenant has
          // already paid. Lowering a bill below its paidAmount would strand an
          // overpayment and violate the bill_balance_consistent CHECK, so such a
          // bill is left untouched (the owner settles the credit manually) and,
          // crucially, no billAdjustment is written — the ledger and the bill
          // can never disagree.
          if (changed && existingBill.paidAmount <= mergedTotal) {
            const delta = mergedTotal - existingBill.totalAmount;
            if (delta !== 0) {
              await tx.insert(billAdjustment).values({
                billId: existingBill.id,
                kind: delta > 0 ? "debit" : "credit",
                amount: Math.abs(delta),
                reason: "Room electricity allocation reconciled after occupancy changed",
                previousTotal: existingBill.totalAmount,
                adjustedTotal: mergedTotal,
              });
            }
            const balance = mergedTotal - existingBill.paidAmount;
            await tx.update(bill).set({
              rentAmount: calculated.rentAmount,
              electricityAmount: calculated.electricityAmount,
              lineItems: mergedLineItems,
              totalAmount: mergedTotal,
              balance,
              status: balance === 0 ? "paid" : isOverdue(existingBill.dueDate) ? "overdue" : existingBill.paidAmount > 0 ? "partial" : "pending",
              updatedAt: new Date(),
            }).where(eq(bill.id, existingBill.id));
          }
          if (!isRequestedTenant || existingBill) {
            skipped += 1;
            continue;
          }
        }

        if (!isRequestedTenant) continue;

        const dueDate = computeDueDate(month, plan?.dueDay ?? 5);
        const revision = existingBill ? existingBill.revision + 1 : 1;

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
            status: isOverdue(dueDate, issuedAt) ? "overdue" : "pending",
            revision,
            supersedesBillId: existingBill?.id,
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
        // Once settled, an invoice is historical financial evidence. A later
        // cron run must not remove a fee that the tenant already paid.
        if (b.balance <= 0 || b.voidedAt) continue;
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
          const totalAmount = withoutLateFee.reduce((sum, line) => sum + line.amount, 0);
          // Removing the LATE line lowers the total. Skip if that would drop the
          // total below what the tenant has already paid — writing
          // balance = total - paid negative (or clamping it) violates the
          // bill_balance_consistent CHECK and would abort the whole batch.
          if (
            withoutLateFee.length !== (b.lineItems as unknown[]).length &&
            totalAmount >= b.paidAmount
          ) {
            const [row] = await tx
              .update(bill)
              .set({
                lineItems: withoutLateFee,
                totalAmount,
                balance: totalAmount - b.paidAmount,
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to update promised date" });
  }
});

// Terminal soft-void: financial records and payments remain immutable audit evidence.
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

    if (target.bill.voidedAt) return res.status(409).json({ error: "Bill is already voided" });

    const [voided] = await db.update(bill).set({
      voidedAt: new Date(),
      balance: 0,
      status: "voided",
      updatedAt: new Date(),
    }).where(eq(bill.id, billId)).returning();

    res.json({ message: "Bill voided", bill: voided });
  } catch (error) {
    res.status(500).json({ error: "Failed to void bill" });
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
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to approve bills" });
  }
});

export default router;
