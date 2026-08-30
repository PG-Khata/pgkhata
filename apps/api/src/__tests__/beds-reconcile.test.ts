import { describe, expect, it } from "vitest";
import { bedLabel, bedLabelsForCapacity, reconcileBeds } from "../lib/beds";

describe("bedLabel", () => {
  it("labels the first beds A through Z", () => {
    expect(bedLabel(0)).toBe("A");
    expect(bedLabel(1)).toBe("B");
    expect(bedLabel(25)).toBe("Z");
  });

  it("continues past Z without repeating a label", () => {
    expect(bedLabel(26)).toBe("AA");
    expect(bedLabel(27)).toBe("AB");
    expect(bedLabel(51)).toBe("AZ");
    expect(bedLabel(52)).toBe("BA");
  });

  it("rejects a negative or fractional index", () => {
    expect(() => bedLabel(-1)).toThrow();
    expect(() => bedLabel(1.5)).toThrow();
  });
});

describe("bedLabelsForCapacity", () => {
  it("produces one label per bed", () => {
    expect(bedLabelsForCapacity(3)).toEqual(["A", "B", "C"]);
  });

  it("produces nothing for a capacity of zero", () => {
    expect(bedLabelsForCapacity(0)).toEqual([]);
  });
});

describe("reconcileBeds", () => {
  it("creates every bed for a new room", () => {
    const result = reconcileBeds([], 3);

    expect(result.toCreate).toEqual(["A", "B", "C"]);
    expect(result.toDelete).toEqual([]);
    expect(result.blockedBy).toEqual([]);
  });

  it("appends beds on a capacity increase and leaves existing ones alone", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "occupied" },
        { number: "B", status: "maintenance" },
      ],
      4,
    );

    // A and B are untouched: a bed is a real place someone sleeps, so it keeps
    // its label, status and rent override.
    expect(result.toCreate).toEqual(["C", "D"]);
    expect(result.toDelete).toEqual([]);
    expect(result.blockedBy).toEqual([]);
  });

  it("does nothing when capacity is unchanged", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "occupied" },
        { number: "B", status: "vacant" },
      ],
      2,
    );

    expect(result.toCreate).toEqual([]);
    expect(result.toDelete).toEqual([]);
  });

  it("removes the highest labels on a capacity decrease", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "occupied" },
        { number: "B", status: "vacant" },
        { number: "C", status: "vacant" },
      ],
      1,
    );

    expect(result.toCreate).toEqual([]);
    expect(result.toDelete).toEqual(["B", "C"]);
    expect(result.blockedBy).toEqual([]);
  });

  it("keeps a bed that is still within the new capacity", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "vacant" },
        { number: "B", status: "occupied" },
        { number: "C", status: "vacant" },
      ],
      2,
    );

    // B is occupied but sits inside the new capacity of 2, so nothing blocks;
    // only the surplus C is dropped.
    expect(result.blockedBy).toEqual([]);
    expect(result.toDelete).toEqual(["C"]);
  });

  it("names every occupied bed that blocks a decrease", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "vacant" },
        { number: "B", status: "occupied" },
        { number: "C", status: "occupied" },
      ],
      1,
    );

    expect(result.blockedBy).toEqual(["B", "C"]);
    // Nothing is deleted while anything is blocked: the shrink is all or nothing.
    expect(result.toDelete).toEqual([]);
  });

  it("allows a decrease that only drops beds under maintenance", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "vacant" },
        { number: "B", status: "maintenance" },
      ],
      1,
    );

    expect(result.blockedBy).toEqual([]);
    expect(result.toDelete).toEqual(["B"]);
  });

  it("fills a gap left by a manually deleted bed", () => {
    const result = reconcileBeds(
      [
        { number: "A", status: "occupied" },
        { number: "C", status: "vacant" },
      ],
      3,
    );

    // B is missing and within capacity, so it is recreated; C is kept.
    expect(result.toCreate).toEqual(["B"]);
    expect(result.toDelete).toEqual([]);
  });
});
