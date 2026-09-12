import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { createPublicWriteLimiter } from "../middleware/public-rate-limit";
import { FixedWindowStore } from "../middleware/rate-limit";

function mockReqRes(token: string, ip: string) {
  const req = { params: { token }, ip, headers: {} } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { setHeader: vi.fn(), status } as unknown as Response;
  const next = vi.fn();
  return { req, res, next, status, json };
}

describe("createPublicWriteLimiter", () => {
  it("allows up to max requests per token+ip, then 429s", () => {
    const limiter = createPublicWriteLimiter(
      { windowMs: 60_000, max: 3 },
      new FixedWindowStore(),
    );

    for (let i = 0; i < 3; i += 1) {
      const { req, res, next, status } = mockReqRes("tok", "1.2.3.4");
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    }

    const { req, res, next, status, json } = mockReqRes("tok", "1.2.3.4");
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
    );
  });

  it("keeps separate buckets per token and per ip", () => {
    const store = new FixedWindowStore();
    const limiter = createPublicWriteLimiter({ windowMs: 60_000, max: 1 }, store);

    // Exhaust token A from ip X.
    const first = mockReqRes("A", "10.0.0.1");
    limiter(first.req, first.res, first.next);
    expect(first.next).toHaveBeenCalledOnce();

    const blocked = mockReqRes("A", "10.0.0.1");
    limiter(blocked.req, blocked.res, blocked.next);
    expect(blocked.status).toHaveBeenCalledWith(429);

    // A different token from the same ip is unaffected.
    const otherToken = mockReqRes("B", "10.0.0.1");
    limiter(otherToken.req, otherToken.res, otherToken.next);
    expect(otherToken.next).toHaveBeenCalledOnce();

    // The same token from a different ip is unaffected.
    const otherIp = mockReqRes("A", "10.0.0.2");
    limiter(otherIp.req, otherIp.res, otherIp.next);
    expect(otherIp.next).toHaveBeenCalledOnce();
  });
});
