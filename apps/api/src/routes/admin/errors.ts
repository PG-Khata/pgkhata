import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../lib/http";

/** SQLSTATE codes that describe a caller conflict, not a server fault. */
const FOREIGN_KEY_VIOLATION = "23503";
const RESTRICT_VIOLATION = "23001";
const UNIQUE_VIOLATION = "23505";

export interface PgErrorShape {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

/**
 * Drizzle wraps driver errors in a DrizzleQueryError whose message is only
 * "Failed query: ...", so the SQLSTATE lives further down the `cause` chain.
 *
 * `__tests__/helpers/pg-error.ts` walks the same chain, but it imports vitest
 * at module scope and so cannot be pulled into a request path.
 */
export function pgErrorFrom(error: unknown): PgErrorShape | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as PgErrorShape & { cause?: unknown };
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorFrom(error)?.code === UNIQUE_VIOLATION;
}

/**
 * Postgres names the blocker in `detail` — `... is still referenced from table
 * "property"` — which is the one piece of information the caller can act on.
 * The constraint name is the fallback; a bare "Internal Server Error" is not.
 */
function referencingTable(pg: PgErrorShape): string {
  return /table "([^"]+)"/.exec(pg.detail ?? "")?.[1] ?? pg.constraint ?? "a related record";
}

/** `Key (slug)=(x) already exists.` -> `slug` */
function conflictingColumns(pg: PgErrorShape): string {
  return /Key \(([^)]+)\)=/.exec(pg.detail ?? "")?.[1] ?? pg.constraint ?? "field";
}

/**
 * Translates database constraint failures into the status they actually mean.
 *
 * Before this existed every admin handler ended in `catch { res.status(500) }`,
 * so `DELETE /admin/owners/:id` answered a foreign-key violation with an opaque
 * 500 — a caller could not tell "the platform is broken" from "this owner still
 * has properties". Mounted once at the end of the admin router; Express 5
 * forwards rejected handler promises here on its own, which is why the handlers
 * below carry no try/catch.
 */
export function adminErrorTranslator(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const pg = pgErrorFrom(err);
  if (!pg?.code) return next(err);

  if (pg.code === FOREIGN_KEY_VIOLATION || pg.code === RESTRICT_VIOLATION) {
    return next(
      new HttpError(409, `Still referenced by ${referencingTable(pg)}; remove those records first`, {
        code: pg.code,
        constraint: pg.constraint,
      }),
    );
  }

  if (pg.code === UNIQUE_VIOLATION) {
    return next(
      new HttpError(409, `A record with that ${conflictingColumns(pg)} already exists`, {
        code: pg.code,
        constraint: pg.constraint,
      }),
    );
  }

  next(err);
}
