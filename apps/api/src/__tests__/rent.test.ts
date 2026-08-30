import { describe, expect, it } from "vitest";
import { resolveMonthlyRent } from "../lib/rent";

describe("resolveMonthlyRent", () => {
  it("falls back to the room's rent when nothing more specific exists", () => {
    const result = resolveMonthlyRent({ roomRent: 6000 });

    expect(result).toEqual({ amount: 6000, source: "room" });
  });

  it("prefers the rent plan over the room", () => {
    const result = resolveMonthlyRent({ roomRent: 6000, planRent: 6500 });

    expect(result).toEqual({ amount: 6500, source: "rent-plan" });
  });

  it("prefers the bed override over the rent plan", () => {
    const result = resolveMonthlyRent({
      roomRent: 6000,
      planRent: 6500,
      bedRent: 7200,
    });

    expect(result).toEqual({ amount: 7200, source: "bed" });
  });

  it("prefers the tenant override above everything else", () => {
    const result = resolveMonthlyRent({
      roomRent: 6000,
      planRent: 6500,
      bedRent: 7200,
      tenantOverride: 5000,
    });

    expect(result).toEqual({ amount: 5000, source: "tenant-override" });
  });

  it("treats null the same as undefined at every level", () => {
    const result = resolveMonthlyRent({
      roomRent: 6000,
      planRent: null,
      bedRent: null,
      tenantOverride: null,
    });

    expect(result).toEqual({ amount: 6000, source: "room" });
  });

  it("honours a tenant override of zero rather than falling through", () => {
    // A negotiated free stay must not be mistaken for "not set".
    const result = resolveMonthlyRent({
      roomRent: 6000,
      tenantOverride: 0,
    });

    expect(result).toEqual({ amount: 0, source: "tenant-override" });
  });

  it("honours a bed override of zero", () => {
    const result = resolveMonthlyRent({ roomRent: 6000, bedRent: 0 });

    expect(result).toEqual({ amount: 0, source: "bed" });
  });

  it("honours a rent plan of zero", () => {
    const result = resolveMonthlyRent({ roomRent: 6000, planRent: 0 });

    expect(result).toEqual({ amount: 0, source: "rent-plan" });
  });

  it("skips a bed override to reach the rent plan when the bed has none", () => {
    const result = resolveMonthlyRent({
      roomRent: 6000,
      planRent: 6800,
      bedRent: null,
    });

    expect(result).toEqual({ amount: 6800, source: "rent-plan" });
  });

  it("skips the rent plan to reach the room when the property has none", () => {
    const result = resolveMonthlyRent({
      roomRent: 6000,
      planRent: undefined,
      bedRent: undefined,
    });

    expect(result).toEqual({ amount: 6000, source: "room" });
  });
});
