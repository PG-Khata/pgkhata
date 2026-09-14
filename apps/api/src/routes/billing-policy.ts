import { Router } from "express";
import { z } from "zod";
import { db, billingPolicy, chargeType, property } from "@pgkhata/db";
import { and, eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { ELECTRICITY_CODE, seedElectricityChargeType } from "../lib/charge-types";

const router = Router({ mergeParams: true });

const updateSchema = z.object({
  advanceHandlingMode: z.enum(["manual", "auto_adjust"]).optional(),
  bookingExpiryDays: z.number().min(1).max(30).optional(),
  autoAllocatePayments: z.boolean().optional(),
  rentCycleMode: z.enum(["calendar_month", "joining_anniversary"]).optional(),
  electricityMode: z.enum(["flat", "meter"]).optional(),
  electricityRatePerUnit: z.number().int().positive().nullable().optional(),
  flatElectricityAmount: z.number().int().positive().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let [policy] = await db.select().from(billingPolicy)
      .where(eq(billingPolicy.propertyId, req.propertyId!)).limit(1);
    if (!policy) {
      [policy] = await db.insert(billingPolicy).values({ propertyId: req.propertyId! }).returning();
    }
    await seedElectricityChargeType(req.propertyId!);
    const [electricity] = await db.select({ defaultAmount: chargeType.defaultAmount }).from(chargeType)
      .where(and(eq(chargeType.propertyId, req.propertyId!), eq(chargeType.code, ELECTRICITY_CODE))).limit(1);
    res.json({
      ...policy,
      electricityMode: req.property!.electricityMode,
      electricityRatePerUnit: req.property!.electricityRatePerUnit,
      flatElectricityAmount: electricity?.defaultAmount ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch billing policy" });
  }
});

router.put("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = updateSchema.parse(req.body);
    await seedElectricityChargeType(req.propertyId!);
    const [electricity] = await db.select({ defaultAmount: chargeType.defaultAmount }).from(chargeType)
      .where(and(eq(chargeType.propertyId, req.propertyId!), eq(chargeType.code, ELECTRICITY_CODE))).limit(1);

    const mode = body.electricityMode ?? req.property!.electricityMode;
    const rate = body.electricityRatePerUnit ?? req.property!.electricityRatePerUnit;
    const flatAmount = body.flatElectricityAmount ?? electricity?.defaultAmount ?? 0;
    if (mode === "meter" && (!rate || rate <= 0)) {
      return res.status(400).json({ error: "Rate per unit must be greater than zero for meter billing" });
    }
    if (mode === "flat" && flatAmount <= 0) {
      return res.status(400).json({ error: "Fixed electricity amount must be greater than zero" });
    }

    const policyFields = {
      advanceHandlingMode: body.advanceHandlingMode,
      bookingExpiryDays: body.bookingExpiryDays,
      autoAllocatePayments: body.autoAllocatePayments,
      rentCycleMode: body.rentCycleMode,
    };
    const updatedPolicy = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: billingPolicy.id }).from(billingPolicy)
        .where(eq(billingPolicy.propertyId, req.propertyId!)).limit(1);
      const [policy] = existing
        ? await tx.update(billingPolicy).set({ ...policyFields, updatedAt: new Date() })
          .where(eq(billingPolicy.propertyId, req.propertyId!)).returning()
        : await tx.insert(billingPolicy).values({ ...policyFields, propertyId: req.propertyId! }).returning();

      await tx.update(property).set({
        electricityMode: mode,
        electricityRatePerUnit: mode === "meter" ? rate : null,
        updatedAt: new Date(),
      }).where(eq(property.id, req.propertyId!));
      await tx.update(chargeType).set({
        defaultAmount: mode === "flat" ? flatAmount : 0,
        updatedAt: new Date(),
      }).where(and(eq(chargeType.propertyId, req.propertyId!), eq(chargeType.code, ELECTRICITY_CODE)));
      return policy;
    });

    res.json({
      ...updatedPolicy,
      electricityMode: mode,
      electricityRatePerUnit: mode === "meter" ? rate : null,
      flatElectricityAmount: mode === "flat" ? flatAmount : 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: "Failed to update billing policy" });
  }
});

export default router;
