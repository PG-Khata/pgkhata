/**
 * Remove Playwright E2E throwaway accounts (emails `e2e-owner-<ts>@pgkhata.test`)
 * and their auth rows from whatever DATABASE_URL points at (root .env by default,
 * i.e. production).
 *
 * WHY THIS EXISTS: an early E2E run reused a developer's running dev servers,
 * which point at the production DB, and its sign-up step created a few throwaway
 * `e2e-owner-*@pgkhata.test` users there. No properties or other data were
 * created. This removes only those users.
 *
 * Dry run (lists, changes nothing):
 *   pnpm --filter @pgkhata/db exec tsx scripts/cleanup-e2e-users.ts
 * Actually delete:
 *   pnpm --filter @pgkhata/db exec tsx scripts/cleanup-e2e-users.ts --delete
 */
import "dotenv/config";
import { like, eq, inArray } from "drizzle-orm";
import { db, pool, user, ownerProfile, property, session, account } from "../src/index";

const DELETE = process.argv.includes("--delete");
const PATTERN = "e2e-owner-%@pgkhata.test";

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/]+)/)?.[1] ?? "unknown";
  console.log(`DB host: ${host}`);

  const users = await db
    .select({ id: user.id, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(like(user.email, PATTERN));

  console.log(`Matched E2E users: ${users.length}`);
  for (const u of users) console.log(`  - ${u.email} (${u.id})  created ${u.createdAt.toISOString()}`);

  // Owner profiles are auto-created on sign-up; check for any (unexpected) data.
  const ownerIds: string[] = [];
  for (const u of users) {
    const [op] = await db.select({ id: ownerProfile.id }).from(ownerProfile).where(eq(ownerProfile.userId, u.id));
    if (op) ownerIds.push(op.id);
  }
  const props = ownerIds.length
    ? await db.select({ id: property.id, name: property.name }).from(property).where(inArray(property.ownerId, ownerIds))
    : [];
  console.log(`Associated properties: ${props.length}`);
  for (const p of props) console.log(`  - ${p.name} (${p.id})`);

  if (users.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }
  if (!DELETE) {
    console.log("\nDry run. Re-run with --delete to remove these users and their auth rows.");
    return;
  }

  if (props.length > 0) {
    console.error(
      `\nRefusing to auto-delete: ${props.length} propert(ies) exist for these users. ` +
        `Investigate, or use scripts/cleanup-test-data.ts for a full cascade.`,
    );
    process.exitCode = 1;
    return;
  }

  const ids = users.map((u) => u.id);
  await db.delete(session).where(inArray(session.userId, ids));
  await db.delete(account).where(inArray(account.userId, ids));
  if (ownerIds.length) await db.delete(ownerProfile).where(inArray(ownerProfile.id, ownerIds));
  await db.delete(user).where(inArray(user.id, ids));
  console.log(`\nDeleted ${ids.length} E2E user(s) and their session/account/owner_profile rows.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(process.exitCode ?? 0);
  })
  .catch(async (error) => {
    console.error("Cleanup failed:", error);
    await pool.end();
    process.exit(1);
  });
