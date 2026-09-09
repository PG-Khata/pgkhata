import { defineConfig } from "vitest/config";

// Integration tests must opt in with a dedicated disposable database. A dead
// connection string lets unit tests import the app without touching a database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:1/pgkhata_test";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "test-secret-key-at-least-32-characters";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Integration tests chain several real HTTP + database round trips
    // sequentially; the 5s default is tuned for unit tests and flakes under
    // any network latency.
    testTimeout: process.env.TEST_DATABASE_URL ? 60000 : 20000,
    hookTimeout: process.env.TEST_DATABASE_URL ? 60000 : 30000,
    maxWorkers: process.env.TEST_DATABASE_URL ? 4 : undefined,
  },
});
