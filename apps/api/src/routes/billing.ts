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
} from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { calculateBill } from "../lib/billing-calculator";
import { readingForMonth } from "../lib/electricity";
import { computeDueDate } from "../lib/due-date";
import { calculateLateFee } from "../lib/late-fee";

const router = Router({ mergeParams: true });

const generateBillsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
});

const applyLateFeesSchema = z.object({
  billIds: z.array(z.string().uuid()).optional(),
  asOf: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

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

// Generate monthly bills
router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = generateBillsSchema.parse(req.body);
    const prop = req.property!;

    // Everything this run needs, read once outside the transaction: active
    // tenants with their room, bed and rent plan, plus the property's active
    // recurring charge types (excluding electricity, which is always computed
    // from readings rather than a flat default).
    const activeTenants = await db
      .select({ tenant: tenant, room: room, bed: bed, plan: rentPlan })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .leftJoin(rentPlan, eq(room.rentPlanId, rentPlan.id))
      .where(and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, "active")));

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

    const readingsByRoom = new Map<string, Array<{ readingDate: Date; units: number }>>();
    if (roomIds.length > 0) {
      const readings = await db
        .select({
          roomId: electricityReading.roomId,
          readingDate: electricityReading.readingDate,
          units: electricityReading.units,
        })
        .from(electricityReading)
        .where(inArray(electricityReading.roomId, roomIds));

      for (const r of readings) {
        const bucket = readingsByRoom.get(r.roomId);
        if (bucket) bucket.push(r);
        else readingsByRoom.set(r.roomId, [r]);
      }
    }

    const occupantsByRoom = new Map<string, number>();
    for (const row of activeTenants) {
      if (!row.room) continue;
      occupantsByRoom.set(row.room.id, (occupantsByRoom.get(row.room.id) ?? 0) + 1);
    }

    // The whole run is one transaction: either every bill this month lands
    // together, or none do. A partial run previously left some tenants billed
    // and others not with no way to tell which had already happened.
    const { generatedBills, skipped } = await db.transaction(async (tx) => {
      const generatedBills: (typeof bill.$inferSelect)[] = [];
      let skipped = 0;

      for (const { tenant: t, room: r, bed: b, plan } of activeTenants) {
        if (!r) continue;

        const reading = readingForMonth(readingsByRoom.get(r.id) ?? [], month);

        const calculated = calculateBill({
          rent: {
            tenantOverride: t.monthlyRentOverride,
            bedRent: b?.monthlyRent,
            planRent: plan?.monthlyRent,
            roomRent: r.monthlyRent,
          },
          electricity: {
            ratePerUnit: prop.electricityRatePerUnit,
            unitsForMonth: reading?.units,
            occupants: occupantsByRoom.get(r.id) ?? 1,
          },
          recurringCharges,
        });

        const dueDate = plan ? computeDueDate(month, plan.dueDay) : computeDueDate(month, 1);

        // Idempotency is enforced by bill_tenant_month_uq rather than by a
        // read-then-insert check, which two concurrent runs both passed.
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
            approved: false,
          })
          .onConflictDoNothing({ target: [bill.tenantId, bill.billMonth] })
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
router.post("/:billId/void", async (req: AuthenticatedRequest, res) => {
  try {
    const billId = param(req, "billId");

    const [target] = await db
      .select({ bill: bill })
      .from(bill)
      .innerJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(bill.id, billId), eq(tenant.propertyId, req.propertyId!)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Bill not found" });

    if (target.bill.voidedAt) {
      return res.status(409).json({ error: "Bill is already voided" });
    }

    const [voided] = await db
      .update(bill)
      .set({
        voidedAt: new Date(),
        balance: 0,
        updatedAt: new Date(),
      })
      .where(eq(bill.id, billId))
      .returning();

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
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to approve bills" });
  }
});

export default router;
