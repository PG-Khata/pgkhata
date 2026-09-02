import { describe, expect, it } from "vitest";
import { calculateBill } from "../lib/billing-calculator";

function base() {
  return {
    rent: { roomRent: 6000 },
    electricity: { occupants: 1 },
    recurringCharges: [],
  };
}

describe("calculateBill", () => {
  it("bills only rent when there is no meter and no other charges", () => {
    const result = calculateBill(base());

    expect(result.lineItems).toEqual([{ code: "RENT", name: "Rent", amount: 6000 }]);
    expect(result.totalAmount).toBe(6000);
    expect(result.electricityAmount).toBe(0);
  });

  it("adds an electricity line for a single occupant", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: 10, unitsForMonth: 50, occupants: 1 },
    });

    expect(result.electricityAmount).toBe(500);
    expect(result.totalAmount).toBe(6500);
    expect(result.lineItems).toContainEqual({
      code: "ELEC",
      name: "Electricity",
      amount: 500,
      units: 50,
      ratePerUnit: 10,
    });
  });

  it("splits electricity evenly among multiple occupants of the room", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: 10, unitsForMonth: 90, occupants: 3 },
    });

    // 900 total, 300 each.
    expect(result.electricityAmount).toBe(300);
  });

  it("rounds a split that does not divide evenly", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: 10, unitsForMonth: 100, occupants: 3 },
    });

    // 1000 / 3 = 333.33 -> 333
    expect(result.electricityAmount).toBe(333);
  });

  it("shows zero electricity, not a missing line, when metered with no reading yet", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: 10, unitsForMonth: null, occupants: 1 },
    });

    expect(result.electricityAmount).toBe(0);
    // The line item is still present so the owner sees "₹0, investigate" —
    // not an electricity charge that silently vanished.
    expect(result.lineItems).toContainEqual({
      code: "ELEC",
      name: "Electricity",
      amount: 0,
      units: 0,
      ratePerUnit: 10,
    });
  });

  it("omits the electricity line entirely for a flat, unmetered property", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: null, unitsForMonth: null, occupants: 1 },
    });

    expect(result.lineItems.some((line) => line.code === "ELEC")).toBe(false);
  });

  it("floors occupants at 1 so a room with zero active tenants does not divide by zero", () => {
    const result = calculateBill({
      ...base(),
      electricity: { ratePerUnit: 10, unitsForMonth: 50, occupants: 0 },
    });

    expect(result.electricityAmount).toBe(500);
  });

  it("prefers the tenant's rent override over the room rent", () => {
    const result = calculateBill({
      ...base(),
      rent: { roomRent: 6000, tenantOverride: 4500 },
    });

    expect(result.rentAmount).toBe(4500);
    expect(result.lineItems[0]).toEqual({ code: "RENT", name: "Rent", amount: 4500 });
  });

  it("resolves rent through the plan when no override exists", () => {
    const result = calculateBill({
      ...base(),
      rent: { roomRent: 6000, planRent: 6800 },
    });

    expect(result.rentAmount).toBe(6800);
  });

  it("adds every recurring charge as its own line", () => {
    const result = calculateBill({
      ...base(),
      recurringCharges: [
        { code: "WATER", name: "Water", amount: 200 },
        { code: "MAINT", name: "Maintenance", amount: 150 },
      ],
    });

    expect(result.lineItems).toEqual([
      { code: "RENT", name: "Rent", amount: 6000 },
      { code: "WATER", name: "Water", amount: 200 },
      { code: "MAINT", name: "Maintenance", amount: 150 },
    ]);
    expect(result.totalAmount).toBe(6350);
  });

  it("sums every line into the total, never a separately tracked figure", () => {
    const result = calculateBill({
      rent: { roomRent: 6000 },
      electricity: { ratePerUnit: 8, unitsForMonth: 40, occupants: 2 },
      recurringCharges: [{ code: "WATER", name: "Water", amount: 100 }],
    });

    const sumOfLines = result.lineItems.reduce((sum, line) => sum + line.amount, 0);
    expect(result.totalAmount).toBe(sumOfLines);
  });

  it("handles a rent-free negotiated stay of zero without dropping the line", () => {
    const result = calculateBill({
      ...base(),
      rent: { roomRent: 6000, tenantOverride: 0 },
    });

    expect(result.rentAmount).toBe(0);
    expect(result.lineItems[0]).toEqual({ code: "RENT", name: "Rent", amount: 0 });
  });
});
