import type { Request, Response } from "express";
import { z } from "zod";
import { and, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Shared parsing and predicate helpers for the five platform-wide admin lists
 * (`/owners`, `/properties`, `/tenants`, `/bills`, `/payments`).
 *
 * Those five are the only lists in the app that are not already narrowed by an
 * owner's `propertyId`, so they are the only ones that need free-text search
 * and cross-cutting filters on top of `pagination()`. Everything here is used
 * by at least two of them; anything that turned out to have a single caller was
 * left inline in that route instead.
 */

/** `count(*)` for the total that goes alongside a page. */
export const countAll = sql<number>`count(*)::int`;

/**
 * `ilike` treats `%` and `_` as wildcards and `\` as the escape character, so
 * pasting a support ticket's raw text straight into a pattern silently changes
 * what it matches. `_` is the dangerous one: it is common in codes and emails
 * and it quietly becomes "any single character", so a search for `PG_01`
 * matches `PG-01` and `PGX01` and the admin has no way to tell.
 *
 * Escaping with a backslash is correct against Postgres' default LIKE escape
 * character, which is what drizzle's `ilike` emits (no `ESCAPE` clause).
 * Backslash itself must go first or it would double-escape the others.
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** `column ILIKE '%value%'` with wildcards in `value` neutralised. */
export function contains(column: AnyPgColumn, value: string): SQL {
  return ilike(column, `%${escapeLike(value)}%`);
}

/**
 * Free-text search across several columns: matches if any one of them contains
 * the term. Nullable columns are fine — `null ILIKE ...` is null, which `or`
 * treats as "not this column".
 */
export function searchAcross(value: string, columns: AnyPgColumn[]): SQL | undefined {
  const trimmed = value.trim();
  if (!trimmed || columns.length === 0) return undefined;
  return or(...columns.map((column) => contains(column, trimmed)));
}

/**
 * Inclusive `from`/`to` bounds on a date or timestamp column. Either side may
 * be omitted; both omitted means no predicate at all rather than a tautology,
 * so the caller can pass the raw query values through.
 */
export function dateRange(
  column: AnyPgColumn,
  from: Date | undefined,
  to: Date | undefined,
): SQL | undefined {
  return every(
    from === undefined ? undefined : gte(column, from),
    to === undefined ? undefined : lte(column, to),
  );
}

/**
 * `and(...)` over conditions that may be absent, returning `undefined` when
 * nothing survives. Drizzle accepts `undefined` as "no WHERE", but `and()` with
 * zero arguments and `and(undefined)` are easy to get subtly wrong by hand at
 * five call sites.
 */
export function every(...conditions: (SQL | undefined)[]): SQL | undefined {
  const present = conditions.filter((condition): condition is SQL => condition !== undefined);
  if (present.length === 0) return undefined;
  return present.length === 1 ? present[0] : and(...present);
}

/*
 * The four query-string scalars below are a deliberately shared vocabulary
 * rather than one-liners repeated per route: they are what makes the five
 * filter schemas read the same way, and each has callers in more than one of
 * them. Anything sort- or amount-shaped turned out to have exactly one caller
 * and was left inline in that route instead.
 */

/**
 * A query-string boolean. `?voided=false` arrives as the string "false", which
 * is truthy, so every one of these filters is a silent inversion waiting to
 * happen if it is read with `Boolean(req.query.voided)`.
 */
export const booleanParam = z.enum(["true", "false"]).transform((value) => value === "true");

/** An ISO date (`YYYY-MM-DD`) or full timestamp, as a `Date`. */
export const dateParam = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" })
  .transform((value) => new Date(value));

/** A UUID foreign key filter. */
export const idParam = z.string().uuid();

/** Free-text search term. Capped so a pathological pattern cannot be pasted in. */
export const searchParam = z.string().trim().min(1).max(200);

/**
 * Validates the filter half of an admin list's query string, answering 400 and
 * returning `null` when it does not hold. Callers do `if (!f) return;`.
 *
 * It writes the response itself rather than throwing `HttpError(400)` because
 * the app-wide error handler replaces the message on a 400 with "Malformed JSON
 * request body" — accurate for a bad body, actively misleading for a bad filter.
 *
 * `page`/`pageSize` are deliberately not part of these schemas: they are
 * validated globally by `validatePaginationQuery` and read by `pagination()`.
 * Zod strips unknown keys, so those (and anything else the UI tacks on) pass
 * through harmlessly, while a *malformed* filter is a 400 rather than a
 * silently ignored parameter that leaves the admin trusting a result set that
 * was never narrowed.
 */
export function parseFilters<T extends z.ZodType>(
  req: Request,
  res: Response,
  schema: T,
): z.infer<T> | null {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid filter", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

/**
 * Index note for the five admin lists.
 *
 * These pages scan platform-wide, so they are the first queries in the app that
 * are not already narrowed by a property. At the current scale — low thousands
 * of rows per table — a sequential scan is microseconds and Postgres will
 * rightly ignore any index we add, so the only index worth having is on the
 * foreign keys the joins hang off. Postgres does not create those automatically
 * (unlike MySQL): `property.owner_id`, `bill.tenant_id` and `bed.room_id` have
 * no standalone index today. `tenant.property_id` and `payment.bill_id` are
 * covered by `idx_tenant_property_status` and `idx_payment_bill_id`.
 *
 * Trigram (`pg_trgm` GIN) indexes for the `ILIKE '%...%'` searches are
 * deliberately not added. They are only worth their write cost and ~10x size
 * somewhere north of ~5k owners / ~50k tenants; below that the planner picks a
 * sequential scan anyway and the index is pure overhead. Revisit when
 * `select count(*) from owner_profile` passes 5000.
 */
