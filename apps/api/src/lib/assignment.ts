import type { BedStatus } from "./beds";

export interface AssignableBed {
  id: string;
  roomId: string;
  number: string;
  status: string;
}

export type AssignmentFailure =
  | { ok: false; reason: "bed-not-found" }
  | { ok: false; reason: "bed-occupied"; bedNumber: string }
  | { ok: false; reason: "bed-maintenance"; bedNumber: string }
  | { ok: false; reason: "room-full"; roomId: string }
  | { ok: false; reason: "no-target" };

export type AssignmentResult =
  | { ok: true; bed: AssignableBed }
  | AssignmentFailure;

/**
 * Chooses the bed a tenant should be put in.
 *
 * Two request shapes reach this. `bedId` is the precise one an owner picks from
 * the structure view. `roomId` is the older shape still used by the tenant form
 * and the public signup link, where the tenant names a room and the system
 * picks a bed — so room assignment is sugar for "the first vacant bed in that
 * room" rather than a second, divergent code path.
 *
 * Pure so every refusal is tested without a database; the caller re-checks
 * inside a transaction and the unique index is the final backstop.
 */
export function resolveBedForAssignment(
  beds: AssignableBed[],
  target: { bedId?: string | null; roomId?: string | null },
): AssignmentResult {
  if (target.bedId) {
    const bed = beds.find((candidate) => candidate.id === target.bedId);
    if (!bed) return { ok: false, reason: "bed-not-found" };

    if (bed.status === "occupied") {
      return { ok: false, reason: "bed-occupied", bedNumber: bed.number };
    }
    if (bed.status === "maintenance") {
      return { ok: false, reason: "bed-maintenance", bedNumber: bed.number };
    }

    return { ok: true, bed };
  }

  if (target.roomId) {
    const roomBeds = beds.filter((candidate) => candidate.roomId === target.roomId);
    if (roomBeds.length === 0) return { ok: false, reason: "bed-not-found" };

    // Lowest label first, so a room fills A, B, C in order rather than
    // scattering tenants across it.
    const vacant = roomBeds
      .filter((candidate) => candidate.status === "vacant")
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

    const first = vacant[0];
    if (!first) return { ok: false, reason: "room-full", roomId: target.roomId };

    return { ok: true, bed: first };
  }

  return { ok: false, reason: "no-target" };
}

/** Owner-facing message for a refusal, given the room number for context. */
export function assignmentErrorMessage(
  failure: AssignmentFailure,
  roomNumber?: string,
): string {
  const at = (bedNumber: string) =>
    roomNumber ? `${roomNumber}-${bedNumber}` : bedNumber;

  switch (failure.reason) {
    case "bed-not-found":
      return "Bed not found";
    case "bed-occupied":
      return `Bed ${at(failure.bedNumber)} is already occupied`;
    case "bed-maintenance":
      return `Bed ${at(failure.bedNumber)} is under maintenance`;
    case "room-full":
      return "Room has no vacant beds";
    case "no-target":
      return "Provide a bed or a room to assign";
  }
}

/** The status a bed takes once a tenant holds it. */
export const OCCUPIED: BedStatus = "occupied";
/** The status a bed returns to when freed. */
export const FREED: BedStatus = "vacant";
