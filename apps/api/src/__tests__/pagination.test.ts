import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { pagination, sendPage, validatePaginationQuery } from "../lib/pagination";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
}

describe("pagination contract", () => {
  it.each(["", "0", "-1", "1.5", "abc"])("rejects invalid page values: %s", (value) => {
    const req = { query: { page: value } } as unknown as Request;
    const res = response();
    validatePaginationQuery(req, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("defaults to 50, caps huge page sizes at 100, and calculates a safe offset", () => {
    expect(pagination({ query: {} } as unknown as Request)).toEqual({ page: 1, pageSize: 50, limit: 51, offset: 0 });
    expect(pagination({ query: { page: "3", pageSize: "999999999" } } as unknown as Request))
      .toEqual({ page: 3, pageSize: 100, limit: 101, offset: 200 });
  });

  it("returns only the requested page and exposes continuation headers", () => {
    const res = response();
    sendPage(res as unknown as Response, [1, 2, 3], { page: 2, pageSize: 2, limit: 3, offset: 2 });
    expect(res.json).toHaveBeenCalledWith([1, 2]);
    expect(res.setHeader).toHaveBeenCalledWith("X-Has-More", "true");
  });
});
