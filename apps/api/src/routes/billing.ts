import { Router } from "express";
import { z } from "zod";
import { db, bill, tenant, room, electricityReading } from "@pgkhata/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { aggregate } from "../lib/http";

const router = Router({ mergeParams: true });

const generateBillsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
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

    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

// Generate monthly bills
router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = generateBillsSchema.parse(req.body);
    const prop = req.property!;

    // Get all active tenants for property
    const activeTenants = await db
      .select({
        tenant: tenant,
        room: room,
      })
      .from(tenant)
      .leftJoin(room, eq(tenant.roomId, room.id))
      .where(and(eq(tenant.propertyId, req.propertyId!), eq(tenant.status, "active")));

    const generatedBills = [];

    for (const { tenant: t, room: r } of activeTenants) {
      if (!r) continue;

      // Check if bill already exists (idempotent)
      const [existing] = await db
        .select()
        .from(bill)
        .where(and(eq(bill.tenantId, t.id), eq(bill.billMonth, month)))
        .limit(1);

      if (existing) continue;

      // Calculate rent
      const rentAmount = t.monthlyRentOverride ?? r.monthlyRent;

      // Calculate electricity
      let electricityAmount = 0;

      if (prop.electricityRatePerUnit) {
        const [reading] = await db
          .select()
          .from(electricityReading)
          .where(eq(electricityReading.roomId, r.id))
          .orderBy(desc(electricityReading.readingDate))
          .limit(1);

        if (reading) {
          // Split among active tenants in room
          const { count } = aggregate(
            await db
              .select({ count: sql<number>`count(*)` })
              .from(tenant)
              .where(and(eq(tenant.roomId, r.id), eq(tenant.status, "active"))),
            { count: 0 },
          );

          const occupants = Math.max(1, count);
          electricityAmount = Math.round(
            (reading.units * prop.electricityRatePerUnit) / occupants,
          );
        }
      }

      const totalAmount = rentAmount + electricityAmount;

      const [newBill] = await db
        .insert(bill)
        .values({
          tenantId: t.id,
          billMonth: month,
          rentAmount,
          electricityAmount,
          totalAmount,
          balance: totalAmount,
          approved: false,
        })
        .returning();

      generatedBills.push(newBill);
    }

    res.status(201).json({
      message: `Generated ${generatedBills.length} bills`,
      bills: generatedBills,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate bills" });
  }
});

// Approve bills
router.post("/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const { billIds } = z.object({ billIds: z.array(z.string().uuid()) }).parse(req.body);

    const approved = await db
      .update(bill)
      .set({ approved: true, updatedAt: new Date() })
      .where(sql`${bill.id} = ANY(${billIds})`)
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
