import { Router } from "express";
import { db, property, room, bed, tenant, bill } from "@pgkhata/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { aggregate } from "../lib/http";

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

export default router;
