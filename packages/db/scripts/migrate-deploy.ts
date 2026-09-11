import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { assertMigrationArtifacts } from "../src/migration-integrity";
import { databaseSslConfig } from "../src/tls";

const envFile = process.env.MIGRATION_ENV_FILE ?? ".env";
config({ path: resolve(import.meta.dirname, "../../../", envFile) });

const migrationsFolder = resolve(process.cwd(), "drizzle");
const lockId = 1_948_207_413;

async function migrationRows(client: PoolClient) {
  const table = await client.query<{ exists: string | null }>(
    "select to_regclass('drizzle.__drizzle_migrations')::text as exists",
  );
  if (!table.rows[0]?.exists) return [];
  const result = await client.query<{ hash: string; created_at: string }>(
    "select hash, created_at from drizzle.__drizzle_migrations order by created_at",
  );
  return result.rows;
}

function pendingMigrations(migrations: MigrationMeta[], lastCreatedAt: number) {
  return migrations.filter((migration) => migration.folderMillis > lastCreatedAt);
}

async function rehearse(client: PoolClient, pending: MigrationMeta[]) {
  await client.query("begin");
  try {
    for (const migration of pending) {
      for (const statement of migration.sql) await client.query(statement);
    }
  } finally {
    await client.query("rollback");
  }
}

async function main() {
  assertMigrationArtifacts(migrationsFolder);
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for deployment migrations");

  const migrations = readMigrationFiles({ migrationsFolder });
  const pool = new Pool({
    connectionString,
    ssl: databaseSslConfig({
      databaseUrl: connectionString,
      nodeEnv: process.env.NODE_ENV,
      sslMode: process.env.DB_SSL_MODE,
    }),
  });
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [lockId]);
    const applied = await migrationRows(client);
    const localByCreatedAt = new Map(migrations.map((item) => [item.folderMillis, item]));
    for (const row of applied) {
      const local = localByCreatedAt.get(Number(row.created_at));
      if (!local || local.hash !== row.hash) {
        throw new Error(`Migration history mismatch at ${row.created_at}; refusing to deploy`);
      }
    }

    const lastCreatedAt = applied.length ? Number(applied.at(-1)!.created_at) : 0;
    const pending = pendingMigrations(migrations, lastCreatedAt);
    if (pending.length) await rehearse(client, pending);
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migration deployment complete (${pending.length} applied).`);
  } finally {
    await client.query("select pg_advisory_unlock($1)", [lockId]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration deployment failed");
  process.exitCode = 1;
});
