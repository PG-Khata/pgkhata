/** Read-only, count-only gate for migrations 0023-0025. It never prints row data. */
import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { databaseSslConfig } from "../src/tls";

const envFile = process.env.MIGRATION_ENV_FILE ?? ".env";
config({ path: resolve(import.meta.dirname, "../../../", envFile) });

type Check = { name: string; query: string; requires?: string };

const checks: Check[] = [
  { name: "tenant_room_property", query: "select count(*)::int as count from tenant t join room r on r.id=t.room_id where t.property_id<>r.property_id" },
  { name: "tenant_requested_room_property", query: "select count(*)::int as count from tenant t join room r on r.id=t.requested_room_id where t.property_id<>r.property_id" },
  { name: "tenant_bed_room", query: "select count(*)::int as count from tenant t join bed b on b.id=t.bed_id where t.room_id is distinct from b.room_id" },
  { name: "tenant_bed_active", query: "select count(*)::int as count from tenant where bed_id is not null and (room_id is null or status<>'active')" },
  { name: "room_floor_property", query: "select count(*)::int as count from room r join floor f on f.id=r.floor_id where r.property_id<>f.property_id" },
  { name: "room_rent_plan_property", query: "select count(*)::int as count from room r join rent_plan p on p.id=r.rent_plan_id where r.property_id<>p.property_id" },
  { name: "expense_category_property", query: "select count(*)::int as count from expense e join expense_category c on c.id=e.category_id where e.property_id<>c.property_id" },
  { name: "deposit_tenant_property", query: "select count(*)::int as count from security_deposit d join tenant t on t.id=d.tenant_id where d.property_id<>t.property_id" },
  { name: "complaint_tenant_property", query: "select count(*)::int as count from complaint c join tenant t on t.id=c.tenant_id where c.property_id<>t.property_id" },
  { name: "permission_staff_property", query: "select count(*)::int as count from module_permission m join staff s on s.id=m.staff_id where m.property_id<>s.property_id" },
  { name: "duplicate_billing_policy", query: "select count(*)::int as count from (select 1 from billing_policy group by property_id having count(*)>1) x" },
  { name: "duplicate_notification_preference", query: "select count(*)::int as count from (select 1 from notification_preference group by property_id,event_type having count(*)>1) x" },
  { name: "duplicate_module_permission", query: "select count(*)::int as count from (select 1 from module_permission group by property_id,staff_id,module having count(*)>1) x" },
  { name: "duplicate_property_amenity", query: "select count(*)::int as count from (select 1 from property_amenity group by property_id,lower(btrim(name)) having count(*)>1) x" },
  { name: "duplicate_electricity_reading", query: "select count(*)::int as count from (select 1 from electricity_reading group by room_id,reading_date having count(*)>1) x" },
  { name: "duplicate_open_bed_occupancy", requires: "occupancy_history", query: "select count(*)::int as count from (select 1 from occupancy_history where ended_on is null group by bed_id having count(*)>1) x" },
  { name: "invalid_bill_amounts", query: "select count(*)::int as count from bill where total_amount<0 or paid_amount<0 or paid_amount>total_amount" },
  { name: "non_positive_payments", query: "select count(*)::int as count from payment where amount<=0" },
];

async function relationExists(client: PoolClient, relation: string) {
  const result = await client.query<{ exists: string | null }>(
    "select to_regclass($1)::text as exists",
    [`public.${relation}`],
  );
  return Boolean(result.rows[0]?.exists);
}

async function main() {
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for readiness inspection");
  const pool = new Pool({
    connectionString,
    ssl: databaseSslConfig({
      databaseUrl: connectionString,
      nodeEnv: process.env.NODE_ENV,
      sslMode: process.env.DB_SSL_MODE,
    }),
  });
  const client = await pool.connect();
  let failures = 0;
  try {
    await client.query("begin read only");
    for (const check of checks) {
      if (check.requires && !(await relationExists(client, check.requires))) {
        console.log(`${check.name}: SKIP (created by a pending migration)`);
        continue;
      }
      const result = await client.query<{ count: number }>(check.query);
      const count = Number(result.rows[0]?.count ?? 0);
      console.log(`${check.name}: ${count === 0 ? "PASS" : `FAIL (${count})`}`);
      if (count !== 0) failures += 1;
    }
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  if (failures) throw new Error(`${failures} constraint-readiness check(s) failed`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Readiness inspection failed");
  process.exitCode = 1;
});
