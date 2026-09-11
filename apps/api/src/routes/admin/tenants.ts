import { Router } from "express";
import { db, user, ownerProfile, property, tenant, bill, payment, room, bed } from "@pgkhata/db";
import { eq, desc, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { param } from "../../lib/http";

/**
 * `PUT`, `DELETE`, `POST /approve` and `POST /reject` on `/tenants/:tenantId`
 * used to live here and were removed.
 *
 * All four set `tenant` columns directly. Approve in particular only flipped
 * `status` to "active": it never claimed a bed, never marked that bed occupied
 * and never created the rent plan the first bill is priced from, so an
 * admin-approved tenant was billed nothing and left their bed showing free.
 * The owner route does all three in one transaction, and support reaches it
 * through impersonation.
 */

const router = Router();

const tenantColumns = {
  id: tenant.id,
  propertyId: tenant.propertyId,
  name: tenant.name,
  phone: tenant.phone,
  email: tenant.email,
  status: tenant.status,
  joiningDate: tenant.joiningDate,
  bedId: tenant.bedId,
  roomId: tenant.roomId,
  createdAt: tenant.createdAt,
  propertyName: property.name,
  ownerName: user.name,
};

router.get("/tenants", async (_req, res) => {
  const tenants = await db
    .select(tenantColumns)
    .from(tenant)
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .orderBy(desc(tenant.createdAt));

  res.json(tenants);
});

router.get("/tenants/:tenantId", async (req: AuthenticatedRequest, res) => {
  const tenantId = param(req, "tenantId");

  const [t] = await db
    .select(tenantColumns)
    .from(tenant)
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(tenant.id, tenantId))
    .limit(1);

  if (!t) return res.status(404).json({ error: "Tenant not found" });
  res.json(t);
});

/** Tenant detail with bill and payment history. */
router.get("/tenants/:tenantId/details", async (req: AuthenticatedRequest, res) => {
  const tenantId = param(req, "tenantId");

  const [t] = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      status: tenant.status,
      joiningDate: tenant.joiningDate,
      propertyName: property.name,
      roomNumber: room.number,
      bedNumber: bed.number,
    })
    .from(tenant)
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .leftJoin(room, eq(tenant.roomId, room.id))
    .leftJoin(bed, eq(tenant.bedId, bed.id))
    .where(eq(tenant.id, tenantId))
    .limit(1);

  if (!t) return res.status(404).json({ error: "Tenant not found" });

  const bills = await db
    .select()
    .from(bill)
    .where(eq(bill.tenantId, tenantId))
    .orderBy(desc(bill.billMonth));

  // A tenant with no bills has no payments either, and `inArray(col, [])`
  // renders as `in ()`, which Postgres rejects as a syntax error.
  const billIds = bills.map((b) => b.id);
  const payments = billIds.length
    ? await db
        .select()
        .from(payment)
        .where(inArray(payment.billId, billIds))
        .orderBy(desc(payment.paymentDate))
    : [];

  res.json({ ...t, bills, payments });
});

export default router;
