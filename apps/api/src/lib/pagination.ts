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
