import { describe, expect, it } from "vitest";
import { authEnvironmentPolicy } from "@pgkhata/auth";

describe("production auth environment policy", () => {
  it("uses only configured origins and secure host-only SameSite cookies", () => {
    const policy = authEnvironmentPolicy({
      nodeEnv: "production",
      corsOrigin: "https://app.example.com, https://admin.example.com",
    });
    expect(policy.trustedOrigins).toEqual(["https://app.example.com", "https://admin.example.com"]);
    expect(policy.cookieAttributes).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(policy.cookieAttributes).not.toHaveProperty("domain");
  });

  it("refuses a production boot that would silently trust localhost", () => {
    expect(() => authEnvironmentPolicy({ nodeEnv: "production" })).toThrow(/CORS_ORIGIN/);
  });
});
