import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@pgkhata/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@pgkhata/auth";
import { requireAuth } from "../middleware/auth";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe("requireAuth", () => {
  it("returns 401 only for a confirmed missing session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
    const res = response();
    await requireAuth({ headers: {} } as Request, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 503 when the session store is unavailable", async () => {
    vi.mocked(auth.api.getSession).mockRejectedValueOnce(new Error("database down"));
    const res = response();
    await requireAuth({ headers: {} } as Request, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
