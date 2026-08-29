import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Properties API", () => {
  it("GET /v1/properties returns 401 without auth", async () => {
    const res = await request(app).get("/v1/properties");
    expect(res.status).toBe(401);
  });

  it("POST /v1/properties returns 401 without auth", async () => {
    const res = await request(app)
      .post("/v1/properties")
      .send({ name: "Test Property" });
    expect(res.status).toBe(401);
  });

  it("GET /v1/properties/:id returns 401 without auth", async () => {
    const res = await request(app).get("/v1/properties/some-id");
    expect(res.status).toBe(401);
  });

  it("PUT /v1/properties/:id returns 401 without auth", async () => {
    const res = await request(app)
      .put("/v1/properties/some-id")
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("DELETE /v1/properties/:id returns 401 without auth", async () => {
    const res = await request(app).delete("/v1/properties/some-id");
    expect(res.status).toBe(401);
  });
});
