import { Router } from "express";
import { z } from "zod";
import { db, user, ownerProfile, property, tenant, bill } from "@pgkhata/db";
import { eq, asc, desc, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";
import { pagination, sendPageWithTotal } from "../../lib/pagination";
import {
  countAll,
  dateParam,
  dateRange,
  every,
  parseFilters,
  searchAcross,
  searchParam,
} from "../../lib/admin-list";

/**
 * `DELETE /owners/:ownerId` used to live here and was removed.
 *
 * It deleted the profile row directly, so it either orphaned every property and
 * tenant hanging off the owner or failed on a foreign key with an opaque 500.
 * There is no owner-side equivalent because deleting an owner is not a support
 * action; offboarding is a deliberate, staged process. `PUT /owners/:ownerId`
 * survives because a phone number carries no domain invariant.
 */

const router = Router();

const ownerUpdateSchema = z.object({
  phone: z.string().trim().min(1).max(20),
});

const ownerColumns = {
  id: ownerProfile.id,
  userId: ownerProfile.userId,
  phone: ownerProfile.phone,
  createdAt: ownerProfile.createdAt,
  updatedAt: ownerProfile.updatedAt,
  name: user.name,
  email: user.email,
};

const ownerFilterSchema = z.object({
  q: searchParam.optional(),
  createdFrom: dateParam.optional(),
  createdTo: dateParam.optional(),
  // Only this list has a sort control, so the direction lives here rather than
  // in the shared vocabulary.
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Platform-wide owner list: one page, with the matching total in
 * `X-Total-Count`.
 *
 * This used to select every owner on the platform and let the browser filter
 * them. That is fine at a dozen owners and indefensible at a few hundred, and
 * it is the same shape of mistake in all five admin lists.
 *
 * Sorting is fixed to `createdAt` (direction is the caller's) rather than an
 * open `sortBy`: signup order is the only ordering support actually asks for
 * ("who joined last week"), and an open column parameter is an injection
 * surface that has to be allow-listed anyway.
 */
router.get("/owners", async (req, res) => {
  const filters = parseFilters(req, res, ownerFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const where = every(
    filters.q ? searchAcross(filters.q, [user.name, user.email, ownerProfile.phone]) : undefined,
    dateRange(ownerProfile.createdAt, filters.createdFrom, filters.createdTo),
  );

  const [owners, totalRows] = await Promise.all([
    db
      .select(ownerColumns)
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(where)
      .orderBy(filters.order === "asc" ? asc(ownerProfile.createdAt) : desc(ownerProfile.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    // The join is repeated here because `q` searches `user.name`/`user.email`,
    // so the count is only right if it sees the same joined rows. `user.id` is
    // unique and `owner_profile.user_id` is unique, so the left join can
    // neither multiply nor drop a row.
    db
      .select({ total: countAll })
      .from(ownerProfile)
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(where),
  ]);

  sendPageWithTotal(res, owners, page, aggregate(totalRows, { total: 0 }).total);
});

router.get("/owners/:ownerId", async (req: AuthenticatedRequest, res) => {
  const ownerId = param(req, "ownerId");

  const [owner] = await db
    .select(ownerColumns)
    .from(ownerProfile)
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(ownerProfile.id, ownerId))
    .limit(1);

  if (!owner) return res.status(404).json({ error: "Owner not found" });

  const properties = await db.select().from(property).where(eq(property.ownerId, ownerId));

  res.json({ ...owner, properties });
});

router.put("/owners/:ownerId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const ownerId = param(req, "ownerId");
  const parsed = ownerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  // Read-then-write in one transaction: the audit log's `before` column is only
  // worth having if it is the row this statement actually replaced.
  const updated = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(ownerProfile)
      .where(eq(ownerProfile.id, ownerId))
      .limit(1);
    if (!before) return null;
    captureBefore(req, before);

    const [row] = await tx
      .update(ownerProfile)
      .set({ phone: parsed.data.phone, updatedAt: new Date() })
      .where(eq(ownerProfile.id, ownerId))
      .returning();
    return row ?? null;
  });

  if (!updated) return res.status(404).json({ error: "Owner not found" });
  res.json(updated);
});

/** Owner detail with tenant list and billing summary. */
router.get("/owners/:ownerId/details", async (req: AuthenticatedRequest, res) => {
  const ownerId = param(req, "ownerId");

  const [owner] = await db
    .select(ownerColumns)
    .from(ownerProfile)
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(ownerProfile.id, ownerId))
    .limit(1);

  if (!owner) return res.status(404).json({ error: "Owner not found" });

  const properties = await db.select().from(property).where(eq(property.ownerId, ownerId));
  const propertyIds = properties.map((p) => p.id);

  // A brand new owner has no properties, and `inArray(col, [])` renders as
  // `in ()`, which Postgres rejects outright. Skipping the query is the only
  // correct reading of "no properties" anyway.
  const tenants = propertyIds.length
    ? await db
        .select({
          id: tenant.id,
          name: tenant.name,
          phone: tenant.phone,
          status: tenant.status,
          propertyName: property.name,
        })
        .from(tenant)
        .leftJoin(property, eq(tenant.propertyId, property.id))
        .where(inArray(tenant.propertyId, propertyIds))
    : [];

  const bills = propertyIds.length
    ? await db
        .select({
          totalAmount: bill.totalAmount,
          paidAmount: bill.paidAmount,
          status: bill.status,
        })
        .from(bill)
        .innerJoin(tenant, eq(bill.tenantId, tenant.id))
        .where(inArray(tenant.propertyId, propertyIds))
    : [];

  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalCollected = bills.reduce((sum, b) => sum + b.paidAmount, 0);

  res.json({
    ...owner,
    properties,
    tenants,
    billingSummary: {
      totalBilled,
      totalCollected,
      totalPending: totalBilled - totalCollected,
      totalBills: bills.length,
    },
  });
});

export default router;
