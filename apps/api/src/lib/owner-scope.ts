import { db, property, tenant } from "@pgkhata/db";
import { eq } from "drizzle-orm";

/**
 * `property.ownerId` is the only column carrying an owner; everything else
 * reaches the owner through `propertyId -> property.ownerId` or
 * `tenantId -> tenant.propertyId`. These helpers are the single place that
 * walks those hops.
 *
 * Both return `[]` for an owner with nothing. Callers MUST treat an empty
 * result as "no rows match" and skip the query entirely — feeding `[]` to
 * `inArray` or to a raw `sql.join` produces `in ()`, which Postgres rejects as
 * a syntax error rather than matching nothing.
 */

/** Property IDs owned by this owner. Empty when the owner has no properties. */
export async function ownerPropertyIds(ownerId: string): Promise<string[]> {
  const props = await db
    .select({ id: property.id })
    .from(property)
    .where(eq(property.ownerId, ownerId));
  return props.map((p) => p.id);
}

/** Tenant IDs across every property this owner holds. Empty when there are none. */
export async function ownerTenantIds(ownerId: string): Promise<string[]> {
  // Joined rather than composed from ownerPropertyIds() so an owner with zero
  // properties never reaches an `inArray(..., [])`.
  const tenants = await db
    .select({ id: tenant.id })
    .from(tenant)
    .innerJoin(property, eq(tenant.propertyId, property.id))
    .where(eq(property.ownerId, ownerId));
  return tenants.map((t) => t.id);
}
