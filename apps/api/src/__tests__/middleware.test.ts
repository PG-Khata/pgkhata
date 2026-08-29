import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import helmet from "helmet";
import cors from "cors";

describe("Security Middleware", () => {
  it("sets security headers via Helmet", async () => {
    const testApp = express();
    testApp.use(helmet());
    testApp.get("/test", (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/test");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets CORS headers", async () => {
    const testApp = express();
    testApp.use(cors({ origin: "http://localhost:3000", credentials: true }));
    testApp.get("/test", (req, res) => res.json({ ok: true }));

    const res = await request(testApp)
      .get("/test")
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("generates request ID when not provided", async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      const requestId = (req.headers["x-request-id"] as string) || "generated-id";
      req.headers["x-request-id"] = requestId;
      res.setHeader("x-request-id", requestId);
      next();
    });
    testApp.get("/test", (req, res) => res.json({ requestId: req.headers["x-request-id"] }));

    const res = await request(testApp).get("/test");
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
