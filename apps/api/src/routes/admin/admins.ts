import { Router } from "express";
import { z } from "zod";
import { db, user, platformAdmin, PLATFORM_ADMIN_ROLES } from "@pgkhata/db";
import { eq, sql, desc, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { requireSuperAdminRole } from "../../middleware/admin";
import { aggregate, param } from "../../lib/http";
import { captureBefore } from "../../lib/audit";
import { createPasswordlessUser, nameFromEmail } from "../../lib/admin-provisioning";
import { isRootAdminEmail } from "../../lib/root-admin";

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
  // Optional: the console only asks for an email, and a display name is derived
  // from it. Present for when a name is worth setting up front.
  name: z.string().trim().min(1).max(120).optional(),
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

/**
 * Who may act on whom. A clear chain of command:
 *   - the founder (a root admin) manages everyone;
 *   - a super_admin manages support admins, but NOT other super_admins and NOT
 *     the founder — peers cannot change each other;
 *   - only the founder may grant super_admin (add or promote one).
 *
 * Returns a message when the action is forbidden, or null when it is allowed.
 * Root targets are already refused before this runs.
 */
function authorizeAdminChange(
  actorIsFounder: boolean,
  targetRole: string,
  next: { role?: string },
): string | null {
  if (targetRole === "super_admin" && !actorIsFounder) {
    return "Only the founder can change a super admin.";
  }
  if (next.role === "super_admin" && !actorIsFounder) {
    return "Only the founder can grant super admin.";
  }
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
  // A root admin is protected end to end; the flag lets the UI disable its
  // controls, but the PATCH/DELETE handlers enforce it regardless.
  res.json(rows.map((row) => ({ ...row, isRoot: isRootAdminEmail(row.email) })));
});

router.post("/admins", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const parsed = adminCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const actorIsFounder = isRootAdminEmail(req.user!.email);
  const grantForbidden = authorizeAdminChange(actorIsFounder, "support", { role: parsed.data.role });
  if (grantForbidden) return res.status(403).json({ error: grantForbidden });

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);

  if (existingUser) {
    const [existing] = await db
      .select({ id: platformAdmin.id })
      .from(platformAdmin)
      .where(eq(platformAdmin.userId, existingUser.id))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: "That user is already a platform admin" });
    }
  }

  // No account yet: provision a passwordless login. It is created by raw insert
  // (see admin-provisioning), so it never gains an owner profile — an admin
  // added here is a platform user, not an owner. They set their own password
  // the first time they sign in.
  const target =
    existingUser ??
    (await createPasswordlessUser(parsed.data.email, parsed.data.name?.trim() || nameFromEmail(parsed.data.email)));

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
      .select({
        id: platformAdmin.id,
        userId: platformAdmin.userId,
        role: platformAdmin.role,
        isActive: platformAdmin.isActive,
        notes: platformAdmin.notes,
        email: user.email,
      })
      .from(platformAdmin)
      .leftJoin(user, eq(platformAdmin.userId, user.id))
      .where(eq(platformAdmin.id, adminId))
      .limit(1);
    if (!before) return {};
    // A protected root admin cannot be changed by anyone, including another
    // super_admin. Checked before anything else and inside the transaction.
    if (isRootAdminEmail(before.email)) {
      return { forbidden: "This is a protected root admin and cannot be changed." };
    }
    // Chain of command: only the founder may touch a super admin, or grant one.
    const notAllowed = authorizeAdminChange(
      isRootAdminEmail(req.user!.email),
      before.role,
      parsed.data,
    );
    if (notAllowed) return { forbidden: notAllowed };
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

  if (updated.forbidden) return res.status(403).json({ error: updated.forbidden });
  if (updated.blocked) return res.status(409).json({ error: updated.blocked });
  if (!updated.row) return res.status(404).json({ error: "Admin not found" });
  res.json(updated.row);
});

router.delete("/admins/:adminId", requireSuperAdminRole, async (req: AuthenticatedRequest, res) => {
  const adminId = param(req, "adminId");

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({
        id: platformAdmin.id,
        userId: platformAdmin.userId,
        role: platformAdmin.role,
        isActive: platformAdmin.isActive,
        notes: platformAdmin.notes,
        email: user.email,
      })
      .from(platformAdmin)
      .leftJoin(user, eq(platformAdmin.userId, user.id))
      .where(eq(platformAdmin.id, adminId))
      .limit(1);
    if (!before) return {};
    if (isRootAdminEmail(before.email)) {
      return { forbidden: "This is a protected root admin and cannot be removed." };
    }
    // Only the founder may remove a super admin; a super_admin may remove support.
    const notAllowed = authorizeAdminChange(isRootAdminEmail(req.user!.email), before.role, {});
    if (notAllowed) return { forbidden: notAllowed };
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

  if (result.forbidden) return res.status(403).json({ error: result.forbidden });
  if (result.blocked) return res.status(409).json({ error: result.blocked });
  if (!result.row) return res.status(404).json({ error: "Admin not found" });
  res.status(204).end();
});

export default router;
