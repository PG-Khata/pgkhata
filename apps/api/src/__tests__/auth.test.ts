import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Authentication", () => {
  it("GET /v1/me returns 401 without session", async () => {
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(401);
  });

  // Auth endpoint tests require a running PostgreSQL database
  // These tests will be enabled when database is configured
  it.skip("POST /api/auth/sign-up/email creates a new user", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up/email")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toHaveProperty("email", "test@example.com");
  });

  it.skip("POST /api/auth/sign-in/email authenticates user", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({
        email: "test@example.com",
        password: "password123",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it.skip("POST /api/auth/sign-in/email rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({
        email: "test@example.com",
        password: "wrongpassword",
      });
    expect(res.status).toBe(401);
  });
});
