import { Router } from "express";
import { z } from "zod";
import { db, chargeType } from "@pgkhata/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { ELECTRICITY_CODE, seedElectricityChargeType } from "../lib/charge-types";

const router = Router({ mergeParams: true });

const codePattern = /^[A-Za-z0-9_]+$/;

const createSchema = z.object({
  name: z.string().min(1).max(50),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(codePattern, "Use letters, numbers and underscores"),
  defaultAmount: z.number().int().min(0).default(0),
  isRecurring: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({ code: true });

router.use(requireAuth, requireOwner, requireProperty);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    // Seeded lazily here too: a property created before this feature shipped
    // would otherwise never get ELEC and billing would have nothing to charge
    // electricity against.
    await seedElectricityChargeType(req.propertyId!);

    const types = await db
      .select()
      .from(chargeType)
      .where(eq(chargeType.propertyId, req.propertyId!))
      .orderBy(asc(chargeType.name));

    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch charge types" });
  }
});

router.get("/:chargeTypeId", async (req: AuthenticatedRequest, res) => {
  try {
    const [type] = await db
      .select()
      .from(chargeType)
      .where(
        and(
          eq(chargeType.id, param(req, "chargeTypeId")),
          eq(chargeType.propertyId, req.propertyId!),
        ),
      )
      .limit(1);

    if (!type) return res.status(404).json({ error: "Charge type not found" });

    res.json(type);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch charge type" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);
    const code = body.code.toUpperCase();

    const [created] = await db
      .insert(chargeType)
      .values({ ...body, code, propertyId: req.propertyId! })
      .onConflictDoNothing({ target: [chargeType.propertyId, chargeType.code] })
      .returning();

    if (!created) {
      return res.status(409).json({ error: `Charge type code ${code} already exists` });
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create charge type" });
  }
});

router.put("/:chargeTypeId", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateSchema.parse(req.body);
    const chargeTypeId = param(req, "chargeTypeId");

    const [existing] = await db
      .select({ id: chargeType.id, code: chargeType.code })
      .from(chargeType)
      .where(and(eq(chargeType.id, chargeTypeId), eq(chargeType.propertyId, req.propertyId!)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Charge type not found" });

    // ELEC's code is load-bearing for billing; renaming it out from under the
    // engine would silently stop the electricity line item from resolving.
    if (existing.code === ELECTRICITY_CODE && body.isActive === false) {
      return res.status(409).json({
        error: "The electricity charge type cannot be deactivated",
      });
    }

    const [updated] = await db
      .update(chargeType)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(chargeType.id, chargeTypeId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update charge type" });
  }
});

router.delete("/:chargeTypeId", async (req: AuthenticatedRequest, res) => {
  try {
    const chargeTypeId = param(req, "chargeTypeId");

    const [existing] = await db
      .select({ id: chargeType.id, code: chargeType.code })
      .from(chargeType)
      .where(and(eq(chargeType.id, chargeTypeId), eq(chargeType.propertyId, req.propertyId!)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Charge type not found" });

    if (existing.code === ELECTRICITY_CODE) {
      return res.status(409).json({ error: "The electricity charge type cannot be deleted" });
    }

    await db.delete(chargeType).where(eq(chargeType.id, chargeTypeId));

    res.json({ message: "Charge type deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete charge type" });
  }
});

export default router;
