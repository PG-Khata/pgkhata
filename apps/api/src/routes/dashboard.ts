import { Router } from "express";
import { db, property, room, tenant, bill } from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { aggregate } from "../lib/http";

const router = Router();

/** Current month as YYYY-MM. */
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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
        .select({ roomCount: sql<number>`count(*)` })
        .from(room)
        .where(inArray(room.propertyId, propertyIds)),
      { roomCount: 0 },
    );

    // Get tenant counts
    const { activeTenants } = aggregate(
      await db
        .select({ activeTenants: sql<number>`count(*)` })
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
        .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(bill.billMonth, month)),
        ),
      { totalBilled: 0 },
    );

    const { totalPaid } = aggregate(
      await db
        .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)` })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(
          and(inArray(tenant.propertyId, propertyIds), eq(bill.billMonth, month)),
        ),
      { totalPaid: 0 },
    );

    const { overdueAmount } = aggregate(
      await db
        .select({ overdueAmount: sql<number>`coalesce(sum(${bill.balance}), 0)` })
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
      totalTenants: activeTenants,
      occupancyRate: roomCount > 0 ? Math.round((activeTenants / roomCount) * 100) : 0,
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
          .select({ roomCount: sql<number>`count(*)` })
          .from(room)
          .where(eq(room.propertyId, prop.id)),
        { roomCount: 0 },
      );

      const { activeTenants } = aggregate(
        await db
          .select({ activeTenants: sql<number>`count(*)` })
          .from(tenant)
          .where(and(eq(tenant.propertyId, prop.id), eq(tenant.status, "active"))),
        { activeTenants: 0 },
      );

      const month = currentMonth();
      const { totalBilled } = aggregate(
        await db
          .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)` })
          .from(bill)
          .innerJoin(tenant, eq(bill.tenantId, tenant.id))
          .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, month))),
        { totalBilled: 0 },
      );

      const { totalPaid } = aggregate(
        await db
          .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)` })
          .from(bill)
          .innerJoin(tenant, eq(bill.tenantId, tenant.id))
          .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, month))),
        { totalPaid: 0 },
      );

      res.json({
        property: prop,
        totalRooms: roomCount,
        activeTenants,
        occupancyRate: roomCount > 0 ? Math.round((activeTenants / roomCount) * 100) : 0,
        monthlyBilled: totalBilled,
        monthlyCollected: totalPaid,
        monthlyPending: totalBilled - totalPaid,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property dashboard" });
    }
  },
);

export default router;
