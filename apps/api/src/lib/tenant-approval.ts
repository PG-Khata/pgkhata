import { randomBytes } from "crypto";

/**
 * Decides the effect of an owner approving or rejecting a tenant who signed
 * up through the public link. Both decisions are terminal — only a tenant
 * still in "pending" can be decided, so a second decision (or a decision on a
 * manually-added, already-active tenant) is rejected rather than silently
 * changing their status.
 */
export type TenantApprovalResult =
  | { ok: true; newStatus: "active" | "rejected" }
  | { ok: false; reason: "not-pending" };

export function decideTenantApproval(
  tenant: { status: string },
  decision: "approve" | "reject",
): TenantApprovalResult {
  if (tenant.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true, newStatus: decision === "approve" ? "active" : "rejected" };
}

/** A random, unguessable token for a tenant's private onboarding link. */
export function generateOnboardingToken(): string {
  return randomBytes(24).toString("base64url");
}
