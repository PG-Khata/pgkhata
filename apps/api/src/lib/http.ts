import type { Request } from "express";

/** Error carrying an HTTP status, translated by the app's error handler. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Express 5 types route params as `string | string[] | undefined`, so every
 * `eq(column, req.params.x)` is a type error and, worse, a silent `undefined`
 * comparison at runtime if a router is ever mounted without the segment.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }
  return value;
}

/**
 * Aggregate queries (`count(*)`, `sum(...)`) always return one row, but the
 * type system cannot know that, and destructuring `const [{ count }] = rows`
 * throws "Cannot destructure property of undefined" when a query is changed to
 * a form that can return none.
 */
export function firstRow<T>(rows: T[]): T | undefined {
  return rows[0];
}

/** First row of an aggregate query, or the supplied zero value. */
export function aggregate<T>(rows: T[], fallback: T): T {
  return rows[0] ?? fallback;
}
