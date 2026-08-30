import { expect } from "vitest";

/** Postgres SQLSTATE codes we assert on. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
/**
 * ON DELETE RESTRICT raises restrict_violation, checked immediately, and is a
 * distinct code from foreign_key_violation — which is what NO ACTION would
 * raise at end of statement. Asserting the right one proves the FK was declared
 * RESTRICT rather than merely left without a cascade.
 */
export const PG_RESTRICT_VIOLATION = "23001";

interface PgErrorShape {
  code?: string;
  constraint?: string;
  detail?: string;
}

/**
 * Drizzle wraps driver errors in a DrizzleQueryError whose message is only
 * "Failed query: ...", so matching on the message proves nothing about which
 * constraint fired. The pg error lives on `cause`.
 */
function pgErrorFrom(error: unknown): PgErrorShape {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as PgErrorShape & { cause?: unknown };
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  throw new Error(
    `No Postgres error found in cause chain: ${String(
      (error as Error)?.message ?? error,
    )}`,
  );
}

/**
 * Asserts a query is rejected by a specific database constraint.
 * Returns the underlying pg error so callers can assert further.
 */
export async function expectPgViolation(
  operation: Promise<unknown>,
  expected: { code: string; constraint: string },
): Promise<PgErrorShape> {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }

  expect(caught, "expected the query to be rejected").toBeDefined();

  const pgError = pgErrorFrom(caught);
  expect(pgError.code).toBe(expected.code);
  expect(pgError.constraint).toBe(expected.constraint);

  return pgError;
}
