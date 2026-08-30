import { describe, expect, it } from "vitest";
import { decideTenantApproval, generateOnboardingToken } from "../lib/tenant-approval";

describe("decideTenantApproval", () => {
  it("approves a pending tenant", () => {
    const result = decideTenantApproval({ status: "pending" }, "approve");
    expect(result).toEqual({ ok: true, newStatus: "active" });
  });

  it("rejects a pending tenant", () => {
    const result = decideTenantApproval({ status: "pending" }, "reject");
    expect(result).toEqual({ ok: true, newStatus: "rejected" });
  });

  it("refuses to re-decide an already active tenant", () => {
    const result = decideTenantApproval({ status: "active" }, "approve");
    expect(result).toEqual({ ok: false, reason: "not-pending" });
  });

  it("refuses to re-decide an already rejected tenant", () => {
    const result = decideTenantApproval({ status: "rejected" }, "approve");
    expect(result).toEqual({ ok: false, reason: "not-pending" });
  });

  it("refuses to decide a tenant who is vacating or has vacated", () => {
    expect(decideTenantApproval({ status: "vacating" }, "reject")).toEqual({
      ok: false,
      reason: "not-pending",
    });
    expect(decideTenantApproval({ status: "vacated" }, "reject")).toEqual({
      ok: false,
      reason: "not-pending",
    });
  });
});

describe("generateOnboardingToken", () => {
  it("returns a non-empty, url-safe string", () => {
    const token = generateOnboardingToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different token on every call", () => {
    const a = generateOnboardingToken();
    const b = generateOnboardingToken();
    expect(a).not.toBe(b);
  });
});
