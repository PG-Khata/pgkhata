/**
 * Script to add a user as a platform admin.
 * Run after deploying migrations: npx tsx scripts/add-platform-admin.ts
 */
import "dotenv/config";
import { db, user, platformAdmin } from "@pgkhata/db";
import { eq } from "drizzle-orm";

const EMAIL = "hey@mukundjha.dev";

async function main() {
  // Find the user by email
  const [existingUser] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, EMAIL))
    .limit(1);

  if (!existingUser) {
    console.error(`User with email ${EMAIL} not found.`);
    process.exit(1);
  }

  // Check if already a platform admin
  const [existingAdmin] = await db
    .select({ id: platformAdmin.id })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, existingUser.id))
    .limit(1);

  if (existingAdmin) {
    console.log(`${EMAIL} is already a platform admin.`);
    process.exit(0);
  }

  // Add as platform admin
  await db.insert(platformAdmin).values({
    userId: existingUser.id,
  });

  console.log(`✓ Added ${EMAIL} as platform admin.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to add platform admin:", err);
  process.exit(1);
});
