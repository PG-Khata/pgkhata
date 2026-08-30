import { describe, expect, it } from "vitest";
import {
  assignmentErrorMessage,
  resolveBedForAssignment,
  type AssignableBed,
} from "../lib/assignment";

function bed(
  id: string,
  roomId: string,
  number: string,
  status: string = "vacant",
): AssignableBed {
  return { id, roomId, number, status };
}

describe("resolveBedForAssignment by bed", () => {
  it("picks the named bed when it is vacant", () => {
    const result = resolveBedForAssignment([bed("b1", "r1", "A")], { bedId: "b1" });

    expect(result).toEqual({ ok: true, bed: bed("b1", "r1", "A") });
  });

  it("refuses a bed that does not exist", () => {
    const result = resolveBedForAssignment([bed("b1", "r1", "A")], { bedId: "nope" });

    expect(result).toEqual({ ok: false, reason: "bed-not-found" });
  });

  it("refuses an occupied bed", () => {
    const result = resolveBedForAssignment([bed("b1", "r1", "A", "occupied")], {
      bedId: "b1",
    });

    expect(result).toEqual({ ok: false, reason: "bed-occupied", bedNumber: "A" });
  });

  it("refuses a bed under maintenance", () => {
    const result = resolveBedForAssignment([bed("b1", "r1", "A", "maintenance")], {
      bedId: "b1",
    });

    expect(result).toEqual({ ok: false, reason: "bed-maintenance", bedNumber: "A" });
  });
});

describe("resolveBedForAssignment by room", () => {
  it("fills a room in label order rather than scattering tenants", () => {
    const result = resolveBedForAssignment(
      [
        bed("b3", "r1", "C"),
        bed("b1", "r1", "A"),
        bed("b2", "r1", "B"),
      ],
      { roomId: "r1" },
    );

    expect(result).toMatchObject({ ok: true, bed: { number: "A" } });
  });

  it("skips an occupied bed and takes the next vacant one", () => {
    const result = resolveBedForAssignment(
      [bed("b1", "r1", "A", "occupied"), bed("b2", "r1", "B")],
      { roomId: "r1" },
    );

    expect(result).toMatchObject({ ok: true, bed: { number: "B" } });
  });

  it("skips a bed under maintenance", () => {
    const result = resolveBedForAssignment(
      [bed("b1", "r1", "A", "maintenance"), bed("b2", "r1", "B")],
      { roomId: "r1" },
    );

    expect(result).toMatchObject({ ok: true, bed: { number: "B" } });
  });

  it("reports a full room when nothing is vacant", () => {
    const result = resolveBedForAssignment(
      [bed("b1", "r1", "A", "occupied"), bed("b2", "r1", "B", "maintenance")],
      { roomId: "r1" },
    );

    expect(result).toEqual({ ok: false, reason: "room-full", roomId: "r1" });
  });

  it("ignores beds in other rooms", () => {
    const result = resolveBedForAssignment(
      [bed("b1", "r1", "A", "occupied"), bed("b2", "r2", "A")],
      { roomId: "r1" },
    );

    expect(result).toEqual({ ok: false, reason: "room-full", roomId: "r1" });
  });

  it("refuses a room with no beds at all", () => {
    const result = resolveBedForAssignment([bed("b1", "r1", "A")], { roomId: "r2" });

    expect(result).toEqual({ ok: false, reason: "bed-not-found" });
  });

  it("orders labels numerically past Z", () => {
    const result = resolveBedForAssignment(
      [bed("b2", "r1", "AA"), bed("b1", "r1", "Z", "occupied")],
      { roomId: "r1" },
    );

    expect(result).toMatchObject({ ok: true, bed: { number: "AA" } });
  });
});

describe("resolveBedForAssignment with no target", () => {
  it("reports that nothing was requested", () => {
    expect(resolveBedForAssignment([bed("b1", "r1", "A")], {})).toEqual({
      ok: false,
      reason: "no-target",
    });
  });

  it("treats explicit nulls as no target", () => {
    expect(
      resolveBedForAssignment([bed("b1", "r1", "A")], { bedId: null, roomId: null }),
    ).toEqual({ ok: false, reason: "no-target" });
  });

  it("prefers bedId when both are supplied", () => {
    const result = resolveBedForAssignment(
      [bed("b1", "r1", "A"), bed("b2", "r2", "A")],
      { bedId: "b2", roomId: "r1" },
    );

    expect(result).toMatchObject({ ok: true, bed: { id: "b2" } });
  });
});

describe("assignmentErrorMessage", () => {
  it("names the bed with its room for an owner reading a toast", () => {
    expect(
      assignmentErrorMessage(
        { ok: false, reason: "bed-occupied", bedNumber: "B" },
        "101",
      ),
    ).toBe("Bed 101-B is already occupied");
  });

  it("falls back to the bare bed label when the room is unknown", () => {
    expect(
      assignmentErrorMessage({ ok: false, reason: "bed-maintenance", bedNumber: "C" }),
    ).toBe("Bed C is under maintenance");
  });

  it("covers every refusal reason", () => {
    const messages = [
      assignmentErrorMessage({ ok: false, reason: "bed-not-found" }),
      assignmentErrorMessage({ ok: false, reason: "room-full", roomId: "r1" }),
      assignmentErrorMessage({ ok: false, reason: "no-target" }),
    ];

    expect(messages.every((message) => message.length > 0)).toBe(true);
  });
});
