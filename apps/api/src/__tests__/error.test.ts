import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";

describe("Error Handling", () => {
  it("returns 500 with request ID on unhandled error", async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.headers["x-request-id"] = "test-request-id";
      next();
    });
    testApp.get("/error", () => {
      throw new Error("Test error");
    });
    testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({
        error: "Internal Server Error",
        requestId: req.headers["x-request-id"],
      });
    });

    const res = await request(testApp).get("/error");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal Server Error");
    expect(res.body).toHaveProperty("requestId", "test-request-id");
  });
});
