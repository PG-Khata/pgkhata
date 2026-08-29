import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Tenants API", () => {
  const propertyId = "test-property-id";

  it("GET /v1/properties/:propertyId/tenants returns 401 without auth", async () => {
    const res = await request(app).get(`/v1/properties/${propertyId}/tenants`);
    expect(res.status).toBe(401);
  });

  it("POST /v1/properties/:propertyId/tenants returns 401 without auth", async () => {
    const res = await request(app)
      .post(`/v1/properties/${propertyId}/tenants`)
      .send({
        name: "Test Tenant",
        phone: "9876543210",
        joiningDate: "2026-01-01",
      });
    expect(res.status).toBe(401);
  });

  it("GET /v1/properties/:propertyId/tenants/:tenantId returns 401 without auth", async () => {
    const res = await request(app).get(
      `/v1/properties/${propertyId}/tenants/some-id`
    );
    expect(res.status).toBe(401);
  });

  it("PUT /v1/properties/:propertyId/tenants/:tenantId returns 401 without auth", async () => {
    const res = await request(app)
      .put(`/v1/properties/${propertyId}/tenants/some-id`)
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("DELETE /v1/properties/:propertyId/tenants/:tenantId returns 401 without auth", async () => {
    const res = await request(app).delete(
      `/v1/properties/${propertyId}/tenants/some-id`
    );
    expect(res.status).toBe(401);
  });
});
