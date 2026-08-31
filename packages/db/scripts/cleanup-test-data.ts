/**
 * One-off cleanup for test rows left behind when a test file crashed before
 * its afterAll teardown ran (debugging billing-line-items.integration.test.ts
 * during Task 9 left several `lineitems-*@pgkhata.test` accounts). Deletes
 * every user whose email matches the given prefix, cascading through the
 * owner's full data in dependency order.
 *
 *   pnpm --filter @pgkhata/db exec tsx scripts/cleanup-test-data.ts <prefix>
 */
import "dotenv/config";
import { like, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  user,
  ownerProfile,
  property,
  floor,
  room,
  bed,
  rentPlan,
  chargeType,
  tenant,
  bill,
  payment,
  electricityReading,
  complaint,
  advancePayment,
  securityDeposit,
  session,
  account,
} from "../src/index";

async function main() {
  const prefix = process.argv[2];
  if (!prefix) {
    console.error("Usage: tsx scripts/cleanup-test-data.ts <email-prefix>");
    process.exit(1);
  }

  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(like(user.email, `${prefix}%`));

  console.log(`Found ${users.length} matching user(s).`);
  for (const u of users) console.log(`  ${u.email}`);

  for (const u of users) {
    const [owner] = await db
      .select({ id: ownerProfile.id })
      .from(ownerProfile)
      .where(eq(ownerProfile.userId, u.id));

    if (owner) {
      const properties = await db
        .select({ id: property.id })
        .from(property)
        .where(eq(property.ownerId, owner.id));
      const propertyIds = properties.map((p) => p.id);

      if (propertyIds.length > 0) {
        const rooms = await db
          .select({ id: room.id })
          .from(room)
          .where(inArray(room.propertyId, propertyIds));
        const roomIds = rooms.map((r) => r.id);

        // Scope tenants by property_id directly, not just via roomIds — a
        // tenant can exist without a room (e.g. before bed assignment), and
        // scoping only through rooms leaves those orphaned.
        const tenants = await db
          .select({ id: tenant.id })
          .from(tenant)
          .where(inArray(tenant.propertyId, propertyIds));
        const tenantIds = tenants.map((t) => t.id);

        if (tenantIds.length > 0) {
          const bills = await db
            .select({ id: bill.id })
            .from(bill)
            .where(inArray(bill.tenantId, tenantIds));
          const billIds = bills.map((b) => b.id);
          if (billIds.length > 0) {
            await db.delete(payment).where(inArray(payment.billId, billIds));
          }
          await db.delete(bill).where(inArray(bill.tenantId, tenantIds));
          await db.delete(advancePayment).where(inArray(advancePayment.tenantId, tenantIds));
        }

        await db.delete(securityDeposit).where(inArray(securityDeposit.propertyId, propertyIds));

        if (tenantIds.length > 0) {
          await db.update(tenant).set({ bedId: null, requestedRoomId: null }).where(inArray(tenant.id, tenantIds));
          await db.delete(tenant).where(inArray(tenant.id, tenantIds));
        }
        if (roomIds.length > 0) {
          await db.delete(electricityReading).where(inArray(electricityReading.roomId, roomIds));
          await db.delete(bed).where(inArray(bed.roomId, roomIds));
        }

        await db.update(room).set({ rentPlanId: null }).where(inArray(room.propertyId, propertyIds));
        await db.delete(room).where(inArray(room.propertyId, propertyIds));
        await db.delete(floor).where(inArray(floor.propertyId, propertyIds));
        await db.delete(rentPlan).where(inArray(rentPlan.propertyId, propertyIds));
        await db.delete(chargeType).where(inArray(chargeType.propertyId, propertyIds));
        await db.delete(complaint).where(inArray(complaint.propertyId, propertyIds));
        await db.delete(property).where(inArray(property.id, propertyIds));
      }

      await db.delete(ownerProfile).where(eq(ownerProfile.id, owner.id));
    }

    await db.delete(session).where(eq(session.userId, u.id));
    await db.delete(account).where(eq(account.userId, u.id));
    await db.delete(user).where(eq(user.id, u.id));
    console.log(`  cleaned ${u.email}`);
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Cleanup failed:", error);
    await pool.end();
    process.exit(1);
  });
