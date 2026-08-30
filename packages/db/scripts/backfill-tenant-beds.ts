/**
 * Assigns a bed to any active tenant that predates the bed model and only
 * carries a room. Idempotent: a tenant that already holds a bed is skipped.
 *
 * Best-effort — the first vacant bed in the tenant's room is used, matching
 * the resolveBedForAssignment "room names a bed" fallback. A room with no
 * vacant bed left (more active tenants than beds, which the old schema never
 * prevented) is reported rather than guessed at.
 *
 *   pnpm --filter @pgkhata/db backfill:tenant-beds
 */
import "dotenv/config";
import { asc, eq, and, isNull } from "drizzle-orm";
import { db, pool, tenant, bed } from "../src/index";

async function main() {
  const orphans = await db
    .select({ id: tenant.id, name: tenant.name, roomId: tenant.roomId })
    .from(tenant)
    .where(and(isNull(tenant.bedId), eq(tenant.status, "active")));

  const withRoom = orphans.filter((t) => t.roomId);
  console.log(
    `Active tenants without a bed: ${orphans.length}. With a room to assign from: ${withRoom.length}.`,
  );

  let assigned = 0;
  let unresolved = 0;

  for (const t of withRoom) {
    const [vacant] = await db
      .select({ id: bed.id, number: bed.number })
      .from(bed)
      .where(and(eq(bed.roomId, t.roomId!), eq(bed.status, "vacant")))
      .orderBy(asc(bed.number))
      .limit(1);

    if (!vacant) {
      console.log(`  ${t.name}: no vacant bed in room ${t.roomId} — needs manual review`);
      unresolved += 1;
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.update(tenant).set({ bedId: vacant.id }).where(eq(tenant.id, t.id));
      await tx.update(bed).set({ status: "occupied" }).where(eq(bed.id, vacant.id));
    });

    console.log(`  ${t.name}: assigned bed ${vacant.number}`);
    assigned += 1;
  }

  console.log(`Assigned ${assigned}. Unresolved: ${unresolved}.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Backfill failed:", error);
    await pool.end();
    process.exit(1);
  });
