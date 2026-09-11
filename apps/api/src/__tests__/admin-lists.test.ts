import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import { PgDialect } from "drizzle-orm/pg-core";
import { property, tenant, user } from "@pgkhata/db";
import {
  MAX_PAGE_SIZE,
  pagination,
  sendPage,
  sendPageWithTotal,
} from "../lib/pagination";
import {
  booleanParam,
  contains,
  dateRange,
  escapeLike,
  every,
  parseFilters,
  searchAcross,
} from "../lib/admin-list";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
}

function query(record: Record<string, unknown>) {
  return { query: record } as unknown as Request;
}

/** Renders a drizzle condition to the SQL text and bound parameters it sends. */
const dialect = new PgDialect();
function render(condition: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return dialect.sqlToQuery(condition);
}

/**
 * The five platform-wide admin lists used to select every row in the table and
 * let the browser filter. These are the guards against that coming back.
 */
const adminLists = [
  ["owners", "owners"],
  ["properties", "properties"],
  ["tenants", "tenants"],
  ["billing", "bills"],
  ["payments", "payments"],
] as const;

describe("admin list bounds", () => {
  it.each(adminLists)("keeps the %s list page-bounded", (file) => {
    const source = readFileSync(resolve(import.meta.dirname, `../routes/admin/${file}.ts`), "utf8");
    expect(source).toContain("pagination(req)");
    expect(source).toContain(".limit(page.limit)");
    expect(source).toContain(".offset(page.offset)");
    expect(source).toContain("sendPageWithTotal(res");
  });

  it("caps pageSize at MAX_PAGE_SIZE however large the caller asks for", () => {
    expect(pagination(query({ pageSize: "100000" })).pageSize).toBe(MAX_PAGE_SIZE);
    expect(pagination(query({ pageSize: "100000" })).limit).toBe(MAX_PAGE_SIZE + 1);
    // Under the cap the caller still gets what they asked for.
    expect(pagination(query({ pageSize: "10" })).pageSize).toBe(10);
  });
});

describe("page envelopes", () => {
  const page = { page: 2, pageSize: 2, limit: 3, offset: 2 };

  /**
   * ~13 owner-facing lists are built on `sendPage`'s hasMore-only contract.
   * Adding a total to it would make every one of them pay for a count(*) they
   * never read, so `sendPageWithTotal` is a second function and this pins the
   * first one unchanged.
   */
  it("leaves sendPage's contract alone: no total, lookahead row trimmed", () => {
    const res = response();
    sendPage(res as unknown as Response, [1, 2, 3], page);
    expect(res.json).toHaveBeenCalledWith([1, 2]);
    expect(res.setHeader).toHaveBeenCalledWith("X-Page", "2");
    expect(res.setHeader).toHaveBeenCalledWith("X-Page-Size", "2");
    expect(res.setHeader).toHaveBeenCalledWith("X-Has-More", "true");
    expect(res.setHeader).not.toHaveBeenCalledWith("X-Total-Count", expect.anything());
  });

  it("adds X-Total-Count without disturbing the other headers", () => {
    const res = response();
    sendPageWithTotal(res as unknown as Response, [1, 2, 3], page, 312);
    expect(res.json).toHaveBeenCalledWith([1, 2]);
    expect(res.setHeader).toHaveBeenCalledWith("X-Page", "2");
    expect(res.setHeader).toHaveBeenCalledWith("X-Page-Size", "2");
    expect(res.setHeader).toHaveBeenCalledWith("X-Has-More", "true");
    expect(res.setHeader).toHaveBeenCalledWith("X-Total-Count", "312");
  });

  it("reports the total even on a last page that has no lookahead row", () => {
    const res = response();
    sendPageWithTotal(res as unknown as Response, [1], page, 5);
    expect(res.json).toHaveBeenCalledWith([1]);
    expect(res.setHeader).toHaveBeenCalledWith("X-Has-More", "false");
    expect(res.setHeader).toHaveBeenCalledWith("X-Total-Count", "5");
  });
});

describe("ilike escaping", () => {
  /**
   * `_` is the dangerous one. Unescaped it means "any single character", so a
   * support agent searching for the property code `PG_01` would silently also
   * match `PG-01` and `PGX01` with nothing in the UI to say so.
   */
  it("escapes the LIKE wildcards", () => {
    expect(escapeLike("PG_01")).toBe("PG\\_01");
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b%c")).toBe("a\\_b\\%c");
  });

  it("escapes the escape character itself, and does so first", () => {
    // If `\` were escaped after `%`, the backslash this step introduces would
    // be doubled again and the `%` would go back to being a wildcard.
    expect(escapeLike("\\")).toBe("\\\\");
    expect(escapeLike("\\%")).toBe("\\\\\\%");
  });

  it("leaves ordinary search text untouched", () => {
    expect(escapeLike("Ramesh Kumar")).toBe("Ramesh Kumar");
    expect(escapeLike("ramesh@example.com")).toBe("ramesh@example.com");
  });

  it("sends the escaped pattern as a bound parameter, not inlined SQL", () => {
    const { sql, params } = render(contains(property.code, "PG_01%"));
    expect(sql).toBe('"property"."code" ilike $1');
    expect(params).toEqual(["%PG\\_01\\%%"]);
  });

  it("searches every named column with the same escaped term", () => {
    const condition = searchAcross("a_b", [user.name, user.email]);
    const { sql, params } = render(condition!);
    expect(sql).toBe('("user"."name" ilike $1 or "user"."email" ilike $2)');
    expect(params).toEqual(["%a\\_b%", "%a\\_b%"]);
  });

  it("produces no predicate for a blank term, rather than matching everything", () => {
    expect(searchAcross("", [user.name])).toBeUndefined();
    expect(searchAcross("   ", [user.name])).toBeUndefined();
  });
});

describe("condition assembly", () => {
  it("drops absent conditions and returns undefined when none remain", () => {
    expect(every(undefined, undefined)).toBeUndefined();
    expect(every()).toBeUndefined();
  });

  it("passes a lone condition through unwrapped", () => {
    const only = contains(property.name, "x");
    expect(every(undefined, only, undefined)).toBe(only);
  });

  it("ands the survivors", () => {
    const { sql } = render(
      every(contains(property.name, "x"), contains(property.city, "y"))!,
    );
    expect(sql).toBe('("property"."name" ilike $1 and "property"."city" ilike $2)');
  });

  it("treats an open-ended date range as one bound, and an empty one as none", () => {
    expect(dateRange(tenant.createdAt, undefined, undefined)).toBeUndefined();
    expect(render(dateRange(tenant.createdAt, new Date("2026-01-01"), undefined)!).sql)
      .toBe('"tenant"."created_at" >= $1');
    expect(render(dateRange(tenant.createdAt, new Date("2026-01-01"), new Date("2026-02-01"))!).sql)
      .toBe('("tenant"."created_at" >= $1 and "tenant"."created_at" <= $2)');
  });
});

describe("filter parsing", () => {
  const schema = z.object({ status: z.enum(["active", "vacated"]).optional(), voided: booleanParam.optional() });

  it("reads query-string booleans by value, not by truthiness", () => {
    // `?voided=false` arrives as the string "false", which is truthy.
    expect(parseFilters(query({ voided: "false" }), response() as unknown as Response, schema))
      .toEqual({ voided: false });
    expect(parseFilters(query({ voided: "true" }), response() as unknown as Response, schema))
      .toEqual({ voided: true });
  });

  it("answers 400 and returns null for a filter value outside the allowed set", () => {
    const res = response();
    const parsed = parseFilters(query({ status: "deleted" }), res as unknown as Response, schema);
    expect(parsed).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid filter" }),
    );
  });

  it("ignores page and pageSize, which pagination() owns", () => {
    const res = response();
    const parsed = parseFilters(query({ page: "3", pageSize: "25" }), res as unknown as Response, schema);
    expect(parsed).toEqual({});
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a repeated parameter instead of silently filtering on an array", () => {
    // `?status=active&status=vacated` arrives as an array; matching on it would
    // throw deep inside drizzle or, worse, filter on "active,vacated".
    const res = response();
    expect(parseFilters(query({ status: ["active", "vacated"] }), res as unknown as Response, schema))
      .toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
