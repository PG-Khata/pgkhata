/**
 * Reports whether the live database can accept the Task 2 constraints.
 *
 * Adding a unique index fails outright if duplicates already exist, which is
 * exactly what happened in the legacy Supabase schema — one migration had to
 * delete duplicate bills before `bills_tenant_month_unique` would apply
 * (see data-points/Database.md). Read before writing.
 *
 *   pnpm --filter @pgkhata/db inspect:constraints
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/index";

async function main() {
  const counts = await db.execute(sql`
    select
      (select count(*)::int from "user")            as users,
      (select count(*)::int from owner_profile)     as owner_profiles,
      (select count(*)::int from property)          as properties,
      (select count(*)::int from room)              as rooms,
      (select count(*)::int from tenant)            as tenants,
      (select count(*)::int from bill)              as bills,
      (select count(*)::int from payment)           as payments,
      (select count(*)::int from electricity_reading) as readings,
      (select count(*)::int from complaint)         as complaints
  `);
  console.log("Row counts:", counts.rows[0]);

  const dupBills = await db.execute(sql`
    select tenant_id, bill_month, count(*)::int as copies
    from bill
    group by tenant_id, bill_month
    having count(*) > 1
    order by copies desc
  `);
  console.log(`\nDuplicate (tenant_id, bill_month) groups: ${dupBills.rows.length}`);
  for (const row of dupBills.rows) console.log("  ", row);

  const dupRooms = await db.execute(sql`
    select property_id, number, count(*)::int as copies
    from room
    group by property_id, number
    having count(*) > 1
    order by copies desc
  `);
  console.log(`\nDuplicate (property_id, number) room groups: ${dupRooms.rows.length}`);
  for (const row of dupRooms.rows) console.log("  ", row);

  // Rows that would violate the amounts invariant once CHECKs arrive later.
  const badAmounts = await db.execute(sql`
    select count(*)::int as bad
    from bill
    where total_amount < 0 or paid_amount < 0 or paid_amount > total_amount
  `);
  console.log(`\nBills violating paid <= total: ${(badAmounts.rows[0] as { bad: number }).bad}`);

  // paid_amount must equal SUM(payments) for the ledger to be the source of truth.
  const drift = await db.execute(sql`
    select b.id, b.paid_amount, coalesce(sum(p.amount), 0)::int as ledger
    from bill b
    left join payment p on p.bill_id = b.id
    group by b.id, b.paid_amount
    having b.paid_amount <> coalesce(sum(p.amount), 0)
  `);
  console.log(`\nBills whose paid_amount disagrees with the payment ledger: ${drift.rows.length}`);
  for (const row of drift.rows) console.log("  ", row);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Inspection failed:", error);
    await pool.end();
    process.exit(1);
  });
