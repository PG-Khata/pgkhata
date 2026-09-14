import { db, chargeType } from "@pgkhata/db";

/** Every property bills electricity today; this is the one charge type that
 * must exist before billing can reference it, so it is seeded rather than
 * left for an owner to remember to create. */
export const ELECTRICITY_CODE = "ELEC";

/**
 * Ensures the property has its baseline charge type. Idempotent via
 * ON CONFLICT DO NOTHING against the (property_id, code) uniqueness, so
 * calling this twice — or from two concurrent property-create requests —
 * never produces a duplicate or an error.
 */
export async function seedElectricityChargeType(propertyId: string, defaultAmount = 0): Promise<void> {
  await db
    .insert(chargeType)
    .values({
      propertyId,
      name: "Electricity",
      code: ELECTRICITY_CODE,
      defaultAmount,
      isRecurring: true,
      isActive: true,
    })
    .onConflictDoNothing({ target: [chargeType.propertyId, chargeType.code] });
}
