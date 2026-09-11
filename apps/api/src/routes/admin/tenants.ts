import { Router } from "express";
import { z } from "zod";
import { db, user, ownerProfile, property, tenant, bill, payment, room, bed } from "@pgkhata/db";
import { eq, desc, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { aggregate, param } from "../../lib/http";
import { pagination, sendPageWithTotal } from "../../lib/pagination";
import { scrubPii } from "../../lib/pii";
import {
  countAll,
  every,
  idParam,
  parseFilters,
  searchAcross,
  searchParam,
} from "../../lib/admin-list";

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

/**
 * The list adds the owner, the police verification state and — the point of the
 * extra two joins — the room and bed *numbers*.
 *
 * The list only ever returned `roomId`/`bedId`, so the admin table had no
 * number to render and showed "Unassigned" for every tenant including the ones
 * holding a bed. Both joins are `left`: a pending signup legitimately holds
 * neither, and an inner join would have quietly dropped exactly the tenants
 * support is looking for.
 */
const tenantListColumns = {
  ...tenantColumns,
  ownerId: property.ownerId,
  policeVerificationStatus: tenant.policeVerificationStatus,
  roomNumber: room.number,
  bedNumber: bed.number,
};

/**
 * KYC identifiers, selected only by the single-tenant view and only ever served
 * through `scrubPii`, which reduces each to its last four digits.
 *
 * Both columns are plaintext `text` in the database. A support agent verifying
 * a caller needs "the Aadhaar ending 9012" and nothing more, so the full value
 * never leaves this API — there is deliberately no reveal endpoint, and adding
 * one would make every admin session a copy of the platform's ID corpus.
 *
 * Kept out of `tenantColumns` on purpose: that object is spread into
 * `tenantListColumns`, so anything added to it ships on a paginated list of up
 * to `MAX_PAGE_SIZE` tenants at a time. Bulk is where masking stops being
 * enough, so identifiers stay off the list entirely.
 */
const tenantIdentityColumns = {
  aadhaarNumber: tenant.aadhaarNumber,
  panNumber: tenant.panNumber,
};

const tenantFilterSchema = z.object({
  q: searchParam.optional(),
  ownerId: idParam.optional(),
  propertyId: idParam.optional(),
  status: z.enum(["pending", "active", "vacating", "vacated", "rejected"]).optional(),
  // Police verification is a statutory obligation for PG operators in most
  // Indian states, so "which of this owner's tenants are still unverified" is a
  // compliance question support gets asked directly, not a nice-to-have facet.
  policeVerificationStatus: z
    .enum(["pending", "submitted", "verified", "rejected", "not_required"])
    .optional(),
});

router.get("/tenants", async (req, res) => {
  const filters = parseFilters(req, res, tenantFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const where = every(
    filters.q ? searchAcross(filters.q, [tenant.name, tenant.phone, tenant.email]) : undefined,
    // `property.ownerId` is the only column carrying an owner, so the owner
    // filter rides the join that is already here rather than pre-resolving a
    // property id list that would be empty for a brand new owner.
    filters.ownerId ? eq(property.ownerId, filters.ownerId) : undefined,
    filters.propertyId ? eq(tenant.propertyId, filters.propertyId) : undefined,
    filters.status ? eq(tenant.status, filters.status) : undefined,
    filters.policeVerificationStatus
      ? eq(tenant.policeVerificationStatus, filters.policeVerificationStatus)
      : undefined,
  );

  const [tenants, totalRows] = await Promise.all([
    db
      .select(tenantListColumns)
      .from(tenant)
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .leftJoin(room, eq(tenant.roomId, room.id))
      .leftJoin(bed, eq(tenant.bedId, bed.id))
      .where(where)
      .orderBy(desc(tenant.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    // Only `property` is joined here because that is the only joined table any
    // filter reads. The others exist purely to decorate the page. If a future
    // filter searches `ownerName` or a room number, it must be joined here too
    // or the total will stop agreeing with the rows.
    db
      .select({ total: countAll })
      .from(tenant)
      .leftJoin(property, eq(tenant.propertyId, property.id))
      .where(where),
  ]);

  sendPageWithTotal(res, scrubPii(tenants), page, aggregate(totalRows, { total: 0 }).total);
});

router.get("/tenants/:tenantId", async (req: AuthenticatedRequest, res) => {
  const tenantId = param(req, "tenantId");

  const [t] = await db
    .select({ ...tenantColumns, ...tenantIdentityColumns })
    .from(tenant)
    .leftJoin(property, eq(tenant.propertyId, property.id))
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(eq(tenant.id, tenantId))
    .limit(1);

  if (!t) return res.status(404).json({ error: "Tenant not found" });
  res.json(scrubPii(t));
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

  res.json(scrubPii({ ...t, bills, payments }));
});

export default router;
