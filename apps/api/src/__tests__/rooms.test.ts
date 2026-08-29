import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Rooms API", () => {
  const propertyId = "test-property-id";

  it("GET /v1/properties/:propertyId/rooms returns 401 without auth", async () => {
    const res = await request(app).get(`/v1/properties/${propertyId}/rooms`);
    expect(res.status).toBe(401);
  });

  it("POST /v1/properties/:propertyId/rooms returns 401 without auth", async () => {
    const res = await request(app)
      .post(`/v1/properties/${propertyId}/rooms`)
      .send({ number: "101", monthlyRent: 10000 });
    expect(res.status).toBe(401);
  });

  it("GET /v1/properties/:propertyId/rooms/:roomId returns 401 without auth", async () => {
    const res = await request(app).get(`/v1/properties/${propertyId}/rooms/some-id`);
    expect(res.status).toBe(401);
  });

  it("PUT /v1/properties/:propertyId/rooms/:roomId returns 401 without auth", async () => {
    const res = await request(app)
      .put(`/v1/properties/${propertyId}/rooms/some-id`)
      .send({ monthlyRent: 12000 });
    expect(res.status).toBe(401);
  });

  it("DELETE /v1/properties/:propertyId/rooms/:roomId returns 401 without auth", async () => {
    const res = await request(app).delete(`/v1/properties/${propertyId}/rooms/some-id`);
    expect(res.status).toBe(401);
  });
});
