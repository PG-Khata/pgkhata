import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseSslConfig } from "./tls";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseSslConfig({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    sslMode: process.env.DB_SSL_MODE,
  }),
});

pool.on("error", (error) => {
  // Idle clients emit errors on the pool. Keeping a listener prevents an
  // EventEmitter 'error' from terminating the process without diagnostics.
  console.error("Unexpected PostgreSQL pool error", error);
});

export const db = drizzle(pool, { schema });

export { pool };
