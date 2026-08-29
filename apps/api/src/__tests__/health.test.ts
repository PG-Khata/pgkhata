import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Health Endpoints", () => {
  it("GET /health returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /ready returns ready status", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ready");
    expect(res.body).toHaveProperty("timestamp");
  });
});
