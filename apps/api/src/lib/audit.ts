import type { AuthenticatedRequest } from "../middleware/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REDACTED_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "secret",
  "otp",
  "accessToken",
  "refreshToken",
  "aadhaarNumber",
  "panNumber",
]);

/** Ids collapse to `:id` so actions aggregate across rows. */
export function normalisePath(path: string): string {
  return path
    .split("/")
    .map((segment) => (UUID_RE.test(segment) ? ":id" : segment))
    .join("/");
}

/** `/v1/admin/owners/<uuid>` -> `{ entityType: "owners", entityId: "<uuid>" }` */
export function entityFrom(path: string): { entityType?: string; entityId?: string } {
  const parts = path.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (UUID_RE.test(parts[i]!)) return { entityType: parts[i - 1], entityId: parts[i] };
  }
  return { entityType: parts.at(-1) };
}

/**
 * Secrets and government identifiers must not be duplicated into a log that is
 * deliberately harder to delete than the row they came from.
 */
export function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, v]) =>
      REDACTED_KEYS.has(key) ? [key, "[redacted]"] : [key, redact(v)],
    ),
  );
}

/**
 * Records the prior state of a row so the audit entry carries a real diff.
 *
 * The response interceptor cannot see prior state, so this is called by hand in
 * the handful of destructive handlers where "what did it used to be" is the
 * question you will actually ask. Everywhere else, the response body is enough.
 */
export function captureBefore(req: AuthenticatedRequest, row: unknown): void {
  (req as AuthenticatedRequest & { auditBefore?: unknown }).auditBefore = row;
}

export function readBefore(req: AuthenticatedRequest): unknown {
  return (req as AuthenticatedRequest & { auditBefore?: unknown }).auditBefore ?? null;
}
