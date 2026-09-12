import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

// E2E MUST run against the disposable test database, never production. The root
// .env points DATABASE_URL at the live `pgkhata` DB, so we deliberately ignore
// it here and force the Neon test DB from .env.test for both the spawned API
// server (below) and this test-runner process (which seeds via @pgkhata/db).
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });
const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) {
  throw new Error(
    "TEST_DATABASE_URL is required for E2E (define it in .env.test). Refusing to run against production.",
  );
}
process.env.DATABASE_URL = TEST_DB;

// Dedicated E2E ports, deliberately NOT the dev ports (3000/3001). Reusing a
// developer's running `pnpm dev` — which points at the production DB via the
// root .env — would run the suite against production. Distinct ports plus
// reuseExistingServer:false below guarantee E2E only ever hits its own
// test-DB-backed servers.
const WEB = "http://localhost:3100";
const API = "http://localhost:3101";

export default defineConfig({
  testDir: "./e2e",
  // The suite shares one seeded owner and hits a real remote DB; keep it serial.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: WEB,
    trace: "on-first-retry",
    // Headless by default; run `HEADED=1 pnpm e2e` (or --headed) to watch it.
    headless: !process.env.HEADED,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/owner.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      // No --env-file: every var is passed explicitly so prod .env can never
      // leak in and point us at the production database.
      command: "npx tsx src/server.ts",
      cwd: path.resolve(__dirname, "../api"),
      url: `${API}/health`,
      timeout: 120_000,
      // Never reuse an already-running server: a dev API on this port would use
      // the production DB. Always spawn our own, test-DB-backed instance.
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NODE_ENV: "development",
        PORT: "3101",
        DATABASE_URL: TEST_DB,
        CORS_ORIGIN: WEB,
        BETTER_AUTH_URL: API,
        BETTER_AUTH_SECRET: "e2e-test-secret-key-at-least-32-characters",
        APP_URL: WEB,
      },
    },
    {
      // Production build + start, not `next dev`: Next allows only one dev
      // server per project dir, so a running `pnpm dev` would block E2E. A
      // separate distDir keeps this fully isolated from the dev server's .next.
      command: "npx next build && npx next start -p 3100",
      cwd: __dirname,
      url: `${WEB}/login`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        API_URL: API,
        NEXT_PUBLIC_API_URL: "/api/backend",
        NEXT_PUBLIC_APP_URL: WEB,
        // Isolated build output so E2E never clobbers a running dev server.
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
