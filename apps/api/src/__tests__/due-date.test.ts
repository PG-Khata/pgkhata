import { describe, expect, it } from "vitest";
import { computeDueDate } from "../lib/due-date";

describe("computeDueDate", () => {
  it("sets the due date five days after the issue date", () => {
    const due = computeDueDate(new Date("2026-09-03T10:00:00.000Z"));

    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(8); // 0-indexed September
    expect(due.getUTCDate()).toBe(8);
  });

  it("crosses a month boundary safely", () => {
    const due = computeDueDate(new Date("2026-02-27T10:00:00.000Z"));

    expect(due.getUTCMonth()).toBe(2);
    expect(due.getUTCDate()).toBe(4);
  });

  it("allows a custom payment window", () => {
    const due = computeDueDate(new Date("2026-01-01T10:00:00.000Z"), 10);

    expect(due.getUTCDate()).toBe(11);
  });
});
