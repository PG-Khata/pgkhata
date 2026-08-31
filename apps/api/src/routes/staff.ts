import { Router } from "express";
import { z } from "zod";
import { db, staff } from "@pgkhata/db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  role: z.enum(["warden", "manager", "accountant", "cleaner"]).default("warden"),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

// Get staff for property
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const staffList = await db
      .select()
      .from(staff)
      .where(eq(staff.propertyId, req.propertyId!));

    res.json(staffList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// Add staff
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);

    const [created] = await db
      .insert(staff)
      .values({ ...body, propertyId: req.propertyId! })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add staff" });
  }
});

// Update staff
router.put("/:staffId", async (req: AuthenticatedRequest, res) => {
  try {
    const staffId = param(req, "staffId");
    const body = updateSchema.parse(req.body);

    const [updated] = await db
      .update(staff)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(staff.id, staffId), eq(staff.propertyId, req.propertyId!)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Staff not found" });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update staff" });
  }
});

// Delete staff
router.delete("/:staffId", async (req: AuthenticatedRequest, res) => {
  try {
    const staffId = param(req, "staffId");

    const [deleted] = await db
      .delete(staff)
      .where(and(eq(staff.id, staffId), eq(staff.propertyId, req.propertyId!)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Staff not found" });

    res.json({ message: "Staff deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

export default router;
