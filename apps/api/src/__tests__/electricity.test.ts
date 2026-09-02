import { describe, expect, it } from "vitest";
import {
  occupiedDaysInReadingPeriod,
  readingForMonth,
  readingPairForMonth,
  rentProrationForMonth,
} from "../lib/electricity";

describe("readingForMonth", () => {
  it("picks the reading dated within the target month", () => {
    const readings = [
      { readingDate: "2026-04-30T00:00:00.000Z", reading: 40 },
      { readingDate: "2026-05-30T00:00:00.000Z", reading: 55 },
      { readingDate: "2026-06-28T00:00:00.000Z", reading: 60 },
    ];

    expect(readingForMonth(readings, "2026-05")).toEqual(readings[1]);
  });

  it("does not fall back to the latest reading when the month has none", () => {
    // The defect this replaces: billing March always used whatever was newest.
    const readings = [
      { readingDate: "2026-04-30T00:00:00.000Z", reading: 40 },
      { readingDate: "2026-06-28T00:00:00.000Z", reading: 60 },
    ];

    expect(readingForMonth(readings, "2026-05")).toBeUndefined();
  });

  it("returns undefined for an empty reading list", () => {
    expect(readingForMonth([], "2026-05")).toBeUndefined();
  });

  it("matches a reading anywhere within the month, including its edges", () => {
    const readings = [{ readingDate: "2026-05-01T00:00:00.000Z", reading: 10 }];

    expect(readingForMonth(readings, "2026-05")).toEqual(readings[0]);

    const lastDay = [{ readingDate: "2026-05-31T23:59:59.999Z", reading: 90 }];
    expect(readingForMonth(lastDay, "2026-05")).toEqual(lastDay[0]);
  });

  it("does not match a reading from the previous or next month", () => {
    const readings = [
      { readingDate: "2026-04-30T23:59:59.999Z", reading: 40 },
      { readingDate: "2026-06-01T00:00:00.000Z", reading: 60 },
    ];

    expect(readingForMonth(readings, "2026-05")).toBeUndefined();
  });

  it("picks the latest of several readings within the same month", () => {
    const readings = [
      { readingDate: "2026-05-01T00:00:00.000Z", reading: 20 },
      { readingDate: "2026-05-15T00:00:00.000Z", reading: 55 },
      { readingDate: "2026-05-30T00:00:00.000Z", reading: 90 },
    ];

    expect(readingForMonth(readings, "2026-05")).toEqual(readings[2]);
  });

  it("uses the first and second reading as one billable period", () => {
    const pair = readingPairForMonth(
      [
        { readingDate: "2026-05-01T00:00:00.000Z", reading: 1010 },
        { readingDate: "2026-05-31T00:00:00.000Z", reading: 1110 },
      ],
      "2026-05",
    );

    expect(pair?.units).toBe(100);
    expect(pair?.first.reading).toBe(1010);
    expect(pair?.second.reading).toBe(1110);
  });

  it("charges a mid-month tenant only for their occupied reading days", () => {
    expect(
      occupiedDaysInReadingPeriod(
        "2026-05-16T00:00:00.000Z",
        "2026-05-01T00:00:00.000Z",
        "2026-05-31T00:00:00.000Z",
      ),
    ).toBe(15);
  });

  it("prorates rent from the tenant's move-in date and skips earlier months", () => {
    expect(rentProrationForMonth("2026-05-16T00:00:00.000Z", "2026-05")).toBeCloseTo(16 / 31);
    expect(rentProrationForMonth("2026-06-01T00:00:00.000Z", "2026-05")).toBe(0);
  });
});
