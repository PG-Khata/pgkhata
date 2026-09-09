import { describe, expect, it } from "vitest";
import { databaseSslConfig } from "@pgkhata/db";

describe("database TLS policy", () => {
  it("verifies remote server certificates", () => {
    expect(databaseSslConfig({ databaseUrl: "postgresql://u:p@db.example.com/app" }))
      .toEqual({ rejectUnauthorized: true });
  });

  it("allows plaintext only for an explicitly configured local development DB", () => {
    expect(databaseSslConfig({ databaseUrl: "postgresql://u:p@localhost/app", sslMode: "disable" }))
      .toBe(false);
  });

  it.each([
    { databaseUrl: "postgresql://u:p@db.example.com/app", sslMode: "disable" },
    { databaseUrl: "postgresql://u:p@localhost/app", sslMode: "disable", nodeEnv: "production" },
  ])("rejects unsafe TLS disable settings", (input) => {
    expect(() => databaseSslConfig(input)).toThrow(/only for a local non-production/i);
  });
});
