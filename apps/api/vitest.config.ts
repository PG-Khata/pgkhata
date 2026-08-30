import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Integration tests chain several real HTTP + database round trips
    // sequentially; the 5s default is tuned for unit tests and flakes under
    // any network latency.
    testTimeout: 20000,
  },
});
