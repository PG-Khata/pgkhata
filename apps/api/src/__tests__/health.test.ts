import { afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../index";
import { pool } from "@pgkhata/db";

afterEach(() => vi.restoreAllMocks());

describe("Health Endpoints", () => {
  it("GET /health returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /ready returns ready status", async () => {
    vi.spyOn(pool, "query").mockResolvedValueOnce({ rows: [{ ok: 1 }] } as never);
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ready");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /ready reports 503 without leaking details when PostgreSQL is down", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("secret database host unavailable"));
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not_ready" });
    expect(JSON.stringify(res.body)).not.toContain("secret database host");
  });

  it("maps malformed JSON to 400", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformed/i);
  });

  it("maps bodies larger than 10 MiB to 413", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ value: "x".repeat(10 * 1024 * 1024 + 1) });
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });
});
