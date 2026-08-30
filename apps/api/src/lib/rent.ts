/**
 * Resolves the monthly rent a tenant owes, in order of specificity:
 *
 *   1. tenant.monthlyRentOverride — a deal struck with this one person
 *   2. bed.monthlyRent            — this specific bed costs more/less
 *   3. rentPlan.monthlyRent       — the plan the room is priced under
 *   4. room.monthlyRent           — the room's own flat rent
 *
 * Pure and independent of the database so every fallback level is tested in
 * isolation. Historical bills store their own computed rentAmount, so
 * changing or deactivating a plan later never alters a bill already issued —
 * this function only matters at generation time.
 */
export interface RentInputs {
  tenantOverride?: number | null;
  bedRent?: number | null;
  planRent?: number | null;
  roomRent: number;
}

export type RentSource = "tenant-override" | "bed" | "rent-plan" | "room";

export interface ResolvedRent {
  amount: number;
  source: RentSource;
}

export function resolveMonthlyRent(inputs: RentInputs): ResolvedRent {
  if (inputs.tenantOverride !== null && inputs.tenantOverride !== undefined) {
    return { amount: inputs.tenantOverride, source: "tenant-override" };
  }
  if (inputs.bedRent !== null && inputs.bedRent !== undefined) {
    return { amount: inputs.bedRent, source: "bed" };
  }
  if (inputs.planRent !== null && inputs.planRent !== undefined) {
    return { amount: inputs.planRent, source: "rent-plan" };
  }
  return { amount: inputs.roomRent, source: "room" };
}
