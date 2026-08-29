import { Router } from "express";
import { db, property, room, tenant, bill, payment } from "@pgkhata/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";

const router = Router();

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
    const [{ roomCount }] = await db
      .select({ roomCount: sql<number>`count(*)` })
      .from(room)
      .where(sql`${room.propertyId} = ANY(${propertyIds})`);

    // Get tenant counts
    const [{ activeTenants }] = await db
      .select({ activeTenants: sql<number>`count(*)` })
      .from(tenant)
      .where(and(sql`${tenant.propertyId} = ANY(${propertyIds})`, eq(tenant.status, "active")));

    // Get current month bills
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [{ totalBilled }] = await db
      .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)` })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(sql`${tenant.propertyId} = ANY(${propertyIds})`, eq(bill.billMonth, currentMonth)));

    const [{ totalPaid }] = await db
      .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)` })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(sql`${tenant.propertyId} = ANY(${propertyIds})`, eq(bill.billMonth, currentMonth)));

    const [{ overdueAmount }] = await db
      .select({ overdueAmount: sql<number>`coalesce(sum(${bill.balance}), 0)` })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(
        sql`${tenant.propertyId} = ANY(${propertyIds})`,
        eq(bill.status, "overdue")
      ));

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
router.get("/property/:propertyId", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const [prop] = await db
      .select()
      .from(property)
      .where(and(eq(property.id, req.params.propertyId), eq(property.ownerId, req.ownerId!)))
      .limit(1);

    if (!prop) return res.status(404).json({ error: "Property not found" });

    const [{ roomCount }] = await db
      .select({ roomCount: sql<number>`count(*)` })
      .from(room)
      .where(eq(room.propertyId, prop.id));

    const [{ activeTenants }] = await db
      .select({ activeTenants: sql<number>`count(*)` })
      .from(tenant)
      .where(and(eq(tenant.propertyId, prop.id), eq(tenant.status, "active")));

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [{ totalBilled }] = await db
      .select({ totalBilled: sql<number>`coalesce(sum(${bill.totalAmount}), 0)` })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, currentMonth)));

    const [{ totalPaid }] = await db
      .select({ totalPaid: sql<number>`coalesce(sum(${bill.paidAmount}), 0)` })
      .from(bill)
      .leftJoin(tenant, eq(bill.tenantId, tenant.id))
      .where(and(eq(tenant.propertyId, prop.id), eq(bill.billMonth, currentMonth)));

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
});

export default router;
