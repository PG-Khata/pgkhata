import { Router } from "express";
import { z } from "zod";
import { db, modulePermission, staff } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  staffId: z.string().uuid(),
  module: z.enum(["tenants", "billing", "expenses", "reports", "structure"]),
  canView: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
});

const updateSchema = z.object({
  canView: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get permissions for a staff member
router.get("/staff/:staffId", async (req: AuthenticatedRequest, res) => {
  try {
    const staffId = param(req, "staffId");

    const [s] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.propertyId, req.propertyId!)))
      .limit(1);

    if (!s) return res.status(404).json({ error: "Staff not found" });

    const permissions = await db
      .select()
      .from(modulePermission)
      .where(eq(modulePermission.staffId, staffId));

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// Set permission for a staff member
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Verify staff belongs to property
    const [s] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, body.staffId), eq(staff.propertyId, req.propertyId!)))
      .limit(1);

    if (!s) return res.status(404).json({ error: "Staff not found" });

    // Upsert: update if exists, create if not
    const [existing] = await db
      .select({ id: modulePermission.id })
      .from(modulePermission)
      .where(
        and(
          eq(modulePermission.staffId, body.staffId),
          eq(modulePermission.module, body.module),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(modulePermission)
        .set({
          canView: body.canView,
          canEdit: body.canEdit,
          canDelete: body.canDelete,
          updatedAt: new Date(),
        })
        .where(eq(modulePermission.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(modulePermission)
      .values({
        propertyId: req.propertyId!,
        staffId: body.staffId,
        module: body.module,
        canView: body.canView,
        canEdit: body.canEdit,
        canDelete: body.canDelete,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to set permission" });
  }
});

// Delete permission
router.delete("/:permissionId", async (req: AuthenticatedRequest, res) => {
  try {
    const permissionId = param(req, "permissionId");

    const [deleted] = await db
      .delete(modulePermission)
      .where(and(eq(modulePermission.id, permissionId), eq(modulePermission.propertyId, req.propertyId!)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Permission not found" });

    res.json({ message: "Permission deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete permission" });
  }
});

export default router;
