import { Router } from "express";
import { z } from "zod";
import { db, user, platformAdmin, PLATFORM_ADMIN_ROLES } from "@pgkhata/db";
import { eq, sql, desc, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";

const router = Router();

// Granting and revoking platform access is the one thing on this surface that
// can escalate privilege, so the whole sub-router is super_admin — there is no
// read here that `support` has any business seeing either.
// Applied per route, deliberately NOT via `router.use(requireSuperAdminRole)`.
// Every admin sub-router is mounted at "/", so a router-level `use` runs for
// EVERY request that reaches this file — including ones a sibling router
// mounted later will actually handle. That made `support` admins get 403 from
// POST /owners/:id/impersonate, i.e. the core support action, despite that
// route being deliberately open to them.

const adminCreateSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(PLATFORM_ADMIN_ROLES),
  notes: z.string().trim().max(500).optional(),
});

const adminUpdateSchema = z
  .object({
    role: z.enum(PLATFORM_ADMIN_ROLES).optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

interface AdminPrivilege {
  role: string;
  isActive: boolean;
}

/**
 * Refuses any change that would leave the platform with no way back in: you
 * cannot demote or deactivate yourself, and the last active super_admin cannot
 * be removed. Without both guards one mis-click bricks the console.
 *
 * Takes the target row rather than re-reading it: the caller has already loaded
 * it inside the same transaction to capture the audit before-image.
 */
async function assertPrivilegeChangeIsSafe(
  tx: typeof db,
  actorAdminId: string,
  targetAdminId: string,
  target: AdminPrivilege,
  next: { role?: string; isActive?: boolean },
): Promise<string | null> {
  if (actorAdminId === targetAdminId) {
    const losingPower = next.role === "support" || next.isActive === false;
    if (losingPower) return "You cannot change your own role or deactivate yourself";
  }

  const losesSuperAdmin = next.role === "support" || next.isActive === false;
  if (!losesSuperAdmin) return null;
  if (target.role !== "super_admin" || !target.isActive) return null;

  const remaining = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(platformAdmin)
    .where(and(eq(platformAdmin.role, "super_admin"), eq(platformAdmin.isActive, true)));
  const { count } = aggregate(remaining, { count: 0 });
  if (count <= 1) return "Cannot remove the last active super admin";
  return null;
}

router.get("/admins", requireSuperAdminRole, async (_req, res) => {
  const rows = await db
    .select({
      id: platformAdmin.id,
      userId: platformAdmin.userId,
      role: platformAdmin.role,
      isActive: platformAdmin.isActive,
      notes: platformAdmin.notes,
      lastLoginAt: platformAdmin.lastLoginAt,
      createdAt: platformAdmin.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(platformAdmin)
    .leftJoin(user, eq(platformAdmin.userId, user.id))
    .orderBy(desc(platformAdmin.createdAt));
  res.json(rows);
});

router.post("/admins", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const parsed = adminCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);
  // Admins are granted to people who already have an account; this endpoint
  // deliberately cannot create a login.
  if (!target) {
    return res.status(404).json({ error: "No user with that email address" });
  }

  const [existing] = await db
    .select({ id: platformAdmin.id })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, target.id))
    .limit(1);
  if (existing) {
    return res.status(409).json({ error: "That user is already a platform admin" });
  }

  const [created] = await db
    .insert(platformAdmin)
    .values({
      userId: target.id,
      role: parsed.data.role,
      notes: parsed.data.notes ?? null,
      createdBy: req.admin!.id,
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/admins/:adminId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const adminId = param(req, "adminId");
  const parsed = adminUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const updated = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(platformAdmin)
      .where(eq(platformAdmin.id, adminId))
      .limit(1);
    if (!before) return {};
    // A privilege change is the audit entry someone will actually go looking
    // for, and it is worthless without the role it replaced.
    captureBefore(req, before);

    const blocked = await assertPrivilegeChangeIsSafe(
      tx as unknown as typeof db,
      req.admin!.id,
      adminId,
      before,
      parsed.data,
    );
    if (blocked) return { blocked };

    const [row] = await tx
      .update(platformAdmin)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(platformAdmin.id, adminId))
      .returning();
    return { row };
  });

  if (updated.blocked) return res.status(409).json({ error: updated.blocked });
  if (!updated.row) return res.status(404).json({ error: "Admin not found" });
  res.json(updated.row);
});

router.delete("/admins/:adminId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const adminId = param(req, "adminId");

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(platformAdmin)
      .where(eq(platformAdmin.id, adminId))
      .limit(1);
    if (!before) return {};
    captureBefore(req, before);

    const blocked = await assertPrivilegeChangeIsSafe(
      tx as unknown as typeof db,
      req.admin!.id,
      adminId,
      before,
      { isActive: false },
    );
    if (blocked) return { blocked };

    const [row] = await tx
      .delete(platformAdmin)
      .where(eq(platformAdmin.id, adminId))
      .returning({ id: platformAdmin.id });
    return { row };
  });

  if (result.blocked) return res.status(409).json({ error: result.blocked });
  if (!result.row) return res.status(404).json({ error: "Admin not found" });
  res.status(204).end();
});

export default router;
