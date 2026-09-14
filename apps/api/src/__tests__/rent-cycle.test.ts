import { describe, expect, it } from "vitest";
import { resolveRentPeriod } from "../lib/rent-cycle";

const date = (value: Date) => value.toISOString().slice(0, 10);

describe("resolveRentPeriod", () => {
  it("prorates a calendar-month tenant from their joining date", () => {
    const period = resolveRentPeriod("2026-09-13", "2026-09", "calendar_month");
    expect(date(period.start)).toBe("2026-09-13");
    expect(date(period.end)).toBe("2026-10-01");
    expect(period.proration).toBe(18 / 30);
  });

  it("charges a full joining-date cycle", () => {
    const period = resolveRentPeriod("2026-09-13", "2026-09", "joining_anniversary");
    expect(date(period.start)).toBe("2026-09-13");
    expect(date(period.end)).toBe("2026-10-13");
    expect(period.proration).toBe(1);
  });

  it("keeps the original anchor after clamping short months", () => {
    expect(date(resolveRentPeriod("2026-01-31", "2026-02", "joining_anniversary").start)).toBe("2026-02-28");
    expect(date(resolveRentPeriod("2026-01-31", "2026-03", "joining_anniversary").start)).toBe("2026-03-31");
  });

  it("does not bill a month before the tenant joined", () => {
    expect(resolveRentPeriod("2026-09-13", "2026-08", "joining_anniversary").billable).toBe(false);
  });
});
