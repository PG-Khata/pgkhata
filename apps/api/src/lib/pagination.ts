import type { Request, Response } from "express";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function validatePaginationQuery(req: Request, res: Response, next: () => void) {
  for (const name of ["page", "pageSize"] as const) {
    const value = req.query[name];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1) {
      return res.status(400).json({ error: `${name} must be a positive integer` });
    }
  }
  next();
}

export function pagination(req: Request) {
  const page = Number(req.query.page ?? 1);
  const requestedPageSize = Number(req.query.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  return { page, pageSize, limit: pageSize + 1, offset: (page - 1) * pageSize };
}

export function sendPage<T>(res: Response, rows: T[], page: ReturnType<typeof pagination>) {
  const hasMore = rows.length > page.pageSize;
  res.setHeader("X-Page", String(page.page));
  res.setHeader("X-Page-Size", String(page.pageSize));
  res.setHeader("X-Has-More", String(hasMore));
  return res.json(hasMore ? rows.slice(0, page.pageSize) : rows);
}

/**
 * `sendPage` plus an `X-Total-Count` header.
 *
 * Deliberately a second function rather than an option on `sendPage`: the
 * ~13 owner-facing lists are keyed off the owner's current property and answer
 * "is there another page", which the lookahead row already tells them. Making
 * them all pay for a `count(*)` to satisfy a header nobody reads would be a
 * regression, and `src/__tests__/bounded-lists.test.ts` pins that contract.
 *
 * The admin console is the opposite case. "How many owners are suspended" is
 * the question the page exists to answer, and the count runs against the whole
 * platform table where the caller cannot narrow it themselves. At platform
 * scale (thousands of rows) the extra count is a sub-millisecond index-only or
 * sequential scan, paid once per page load.
 *
 * `total` is the number of rows matching the filter *before* limit/offset, so
 * the client can render "showing 1-50 of 312" and size a pager.
 */
export function sendPageWithTotal<T>(
  res: Response,
  rows: T[],
  page: ReturnType<typeof pagination>,
  total: number,
) {
  const hasMore = rows.length > page.pageSize;
  res.setHeader("X-Page", String(page.page));
  res.setHeader("X-Page-Size", String(page.pageSize));
  res.setHeader("X-Has-More", String(hasMore));
  res.setHeader("X-Total-Count", String(total));
  return res.json(hasMore ? rows.slice(0, page.pageSize) : rows);
}
