/**
 * Backfills `owner_profile` rows for users created before the Better Auth
 * `user.create.after` hook existed. Those accounts receive 403 "Owner profile
 * not found" from every owner-scoped route until this runs.
 *
 * Idempotent: relies on `owner_profile_user_id_unique` via ON CONFLICT DO
 * NOTHING, so re-running is a no-op.
 *
 *   pnpm --filter @pgkhata/db backfill:owner-profiles
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool, ownerProfile, user } from "../src/index";

async function main() {
  const [users] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user);
  const userCount = users?.count ?? 0;

  const [profiles] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ownerProfile);
  const profilesBefore = profiles?.count ?? 0;

  const orphans = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      sql`not exists (select 1 from ${ownerProfile} where ${ownerProfile.userId} = ${user.id})`,
    );

  if (orphans.length === 0) {
    console.log(
      `No backfill needed: ${userCount} user(s), ${profilesBefore} profile(s).`,
    );
    return;
  }

  const inserted = await db
    .insert(ownerProfile)
    .values(orphans.map((u) => ({ userId: u.id })))
    .onConflictDoNothing({ target: ownerProfile.userId })
    .returning({ id: ownerProfile.id, userId: ownerProfile.userId });

  console.log(
    `Users: ${userCount}. Profiles before: ${profilesBefore}. ` +
      `Missing: ${orphans.length}. Created: ${inserted.length}.`,
  );
  for (const u of orphans) {
    console.log(`  provisioned ${u.email}`);
  }
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
