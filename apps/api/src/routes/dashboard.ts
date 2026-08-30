import { Router } from "express";
import { db, property, room, bed, tenant, bill, payment, expense } from "@pgkhata/db";
import { eq, and, sql, inArray, gte } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { aggregate } from "../lib/http";
import { daysOverdue, summarizeAging, buildMonthlyTrend } from "../lib/dashboard-analytics";

const router = Router();

/** Current month as YYYY-MM. */
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

interface Occupancy {
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
}

/**
 * Occupancy is beds, not rooms.
 *
 * This previously divided active tenants by room count, so a 3-bed room with
 * one tenant reported 100% occupied and an owner could not see they had two
 * beds to fill. Counting beds also makes the figure fall correctly when a bed
 * is taken out of use for maintenance.
 */
async function occupancyFor(propertyIds: string[]): Promise<Occupancy> {
  if (propertyIds.length === 0) {
    return { totalBeds: 0, occupiedBeds: 0, occupancyRate: 0 };
  }

  const { totalBeds, occupiedBeds } = aggregate(
    await db
      .select({
        totalBeds: sql<number>`count(*)::int`,
        occupiedBeds: sql<number>`count(*) filter (where ${bed.status} = 'occupied')::int`,
      })
      .from(bed)
      .innerJoin(room, eq(bed.roomId, room.id))
      .where(inArray(room.propertyId, propertyIds)),
    { totalBeds: 0, occupiedBeds: 0 },
  );

  return {
    totalBeds,
    occupiedBeds,
    occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
  };
}

// Owner dashboard - portfolio view
router.get("/owner", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const properties = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, req.ownerId!));

    const propertyIds = properties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return res.json({
        totalProperties: 0,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        totalTenants: 0,
        occupancyRate: 0,
        monthlyCollection: 0,
        pendingRent: 0,
        overdueRent: 0,
      });
    }

    // Get room count
    const { roomCount } = aggregate(
      await db
        .select({ roomCount: sql<number>`count(*)::int` })
        .from(room)
        .where(inArray(room.propertyId, propertyIds)),
      { roomCount: 0 },
    );

    const occupancy = await occupancyFor(propertyIds);

    // Get tenant counts
    const { activeTenants } = aggregate(
      await db
        .select({ activeTenants: sql<number>`count(*)::int` })
        .from(tenant)
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(tenant.status, "active")),
        ),
      { activeTenants: 0 },
    );

    // Get current month bills
    const month = currentMonth();
    const { totalBilled } = aggregate(
      await db
        .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)::int` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(bill.billMonth, month)),
        ),
      { totalBilled: 0 },
    );

    const { totalPaid } = aggregate(
      await db
        .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)::int` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(bill.billMonth, month)),
        ),
      { totalPaid: 0 },
    );

    const { overdueAmount } = aggregate(
      await db
        .select({ overdueAmount: sql<number>`coalesce(sum(${bill.balance}), 0)::int` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(bill.status, "overdue")),
        ),
      { overdueAmount: 0 },
    );

    res.json({
      totalProperties: properties.length,
      totalRooms: roomCount,
      totalBeds: occupancy.totalBeds,
      occupiedBeds: occupancy.occupiedBeds,
      totalTenants: activeTenants,
      occupancyRate: occupancy.occupancyRate,
      monthlyCollection: totalPaid,
      pendingRent: totalBilled - totalPaid,
      overdueRent: overdueAmount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// Property dashboard
router.get(
  "/property/:propertyId",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req: AuthenticatedRequest, res) => {
    try {
      const prop = req.property!;

      const { roomCount } = aggregate(
        await db
          .select({ roomCount: sql<number>`count(*)::int` })
          .from(room)
          .where(eq(room.propertyId, prop.id)),
        { roomCount: 0 },
      );

      const { activeTenants } = aggregate(
        await db
          .select({ activeTenants: sql<number>`count(*)::int` })
          .from(tenant)
          .where(and(eq(tenant.propertyId, prop.id), eq(tenant.status, "active"))),
        { activeTenants: 0 },
      );

      const occupancy = await occupancyFor([prop.id]);

      const month = currentMonth();
      const { totalBilled } = aggregate(
        await db
          .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)::int` })
          .from(bill)
          .innerJoin(tenant, eq(bill.tenantId, tenant.id))
          .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, month))),
        { totalBilled: 0 },
      );

      const { totalPaid } = aggregate(
        await db
          .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)::int` })
          .from(bill)
          .innerJoin(tenant, eq(bill.tenantId, tenant.id))
          .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, month))),
        { totalPaid: 0 },
      );

      res.json({
        property: prop,
        totalRooms: roomCount,
        totalBeds: occupancy.totalBeds,
        occupiedBeds: occupancy.occupiedBeds,
        activeTenants,
        occupancyRate: occupancy.occupancyRate,
        monthlyBilled: totalBilled,
        monthlyCollected: totalPaid,
        monthlyPending: totalBilled - totalPaid,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property dashboard" });
    }
  },
);

/** Last 6 calendar months of rent collected vs approved expenses. */
router.get(
  "/property/:propertyId/monthly-trend",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req: AuthenticatedRequest, res) => {
    try {
      const propertyId = req.propertyId!;
      const months = 6;
      const since = new Date();
      since.setMonth(since.getMonth() - (months - 1));
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const collectedRows = await db
        .select({
          month: sql<string>`to_char(${payment.paymentDate}, 'YYYY-MM')`,
          collected: sql<number>`coalesce(sum(${payment.amount}), 0)::int`,
        })
        .from(payment)
        .innerJoin(bill, eq(payment.billId, bill.id))
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(and(eq(tenant.propertyId, propertyId), gte(payment.paymentDate, since)))
        .groupBy(sql`to_char(${payment.paymentDate}, 'YYYY-MM')`);

      const expenseRows = await db
        .select({
          month: sql<string>`to_char(${expense.date}, 'YYYY-MM')`,
          expenses: sql<number>`coalesce(sum(${expense.amount}), 0)::int`,
        })
        .from(expense)
        .where(
          and(
            eq(expense.propertyId, propertyId),
            eq(expense.status, "approved"),
            gte(expense.date, since),
          ),
        )
        .groupBy(sql`to_char(${expense.date}, 'YYYY-MM')`);

      const collectedByMonth = new Map(collectedRows.map((r) => [r.month, r.collected]));
      const expensesByMonth = new Map(expenseRows.map((r) => [r.month, r.expenses]));
      const allMonths = new Set([...collectedByMonth.keys(), ...expensesByMonth.keys()]);

      const merged = Array.from(allMonths).map((month) => ({
        month,
        collected: collectedByMonth.get(month) ?? 0,
        expenses: expensesByMonth.get(month) ?? 0,
      }));

      res.json(buildMonthlyTrend(merged, months));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monthly trend" });
    }
  },
);

/** Tenants with an outstanding bill balance, most overdue first. */
router.get(
  "/property/:propertyId/due-rent",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await db
        .select({
          tenantId: tenant.id,
          tenantName: tenant.name,
          roomNumber: room.number,
          amountDue: bill.balance,
          dueDate: bill.dueDate,
        })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .leftJoin(room, eq(tenant.roomId, room.id))
        .where(and(eq(tenant.propertyId, req.propertyId!), sql`${bill.balance} > 0`))
        .orderBy(bill.dueDate);

      const withOverdue = rows
        .map((r) => ({
          tenantId: r.tenantId,
          tenantName: r.tenantName,
          roomNumber: r.roomNumber,
          amountDue: r.amountDue,
          daysOverdue: daysOverdue(r.dueDate),
        }))
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

      res.json(withOverdue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch due rent" });
    }
  },
);

/** Outstanding balances grouped into aging buckets (current/0-30/31-60/61-90/90+). */
router.get(
  "/property/:propertyId/outstanding-payment",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await db
        .select({
          tenantId: tenant.id,
          balance: bill.balance,
          dueDate: bill.dueDate,
        })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(and(eq(tenant.propertyId, req.propertyId!), sql`${bill.balance} > 0`));

      const agingRows = rows.map((r) => ({
        tenantId: r.tenantId,
        balance: r.balance,
        daysOverdue: daysOverdue(r.dueDate),
      }));

      res.json(summarizeAging(agingRows));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch outstanding payment breakdown" });
    }
  },
);

export default router;
