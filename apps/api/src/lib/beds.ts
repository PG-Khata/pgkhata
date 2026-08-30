/** Bed statuses. A bed is vacant unless a tenant holds it or it is out of use. */
export const BED_STATUSES = ["vacant", "occupied", "maintenance"] as const;
export type BedStatus = (typeof BED_STATUSES)[number];

/**
 * Spreadsheet-style labels so a room reads 101-A, 101-B, 101-C.
 * 0 -> A, 25 -> Z, 26 -> AA. Room capacity caps at 20, but the scheme does not
 * break if that ever changes.
 */
export function bedLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Bed index must be a non-negative integer, got ${index}`);
  }

  let label = "";
  let remaining = index;

  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);

  return label;
}

/** The labels a room of `capacity` beds should have, in order. */
export function bedLabelsForCapacity(capacity: number): string[] {
  return Array.from({ length: capacity }, (_, index) => bedLabel(index));
}

export interface ExistingBed {
  number: string;
  status: string;
}

export interface BedReconciliation {
  /** Labels to insert, in order. */
  toCreate: string[];
  /** Labels to delete because capacity shrank. */
  toDelete: string[];
  /** Labels that must be freed before the shrink is allowed. */
  blockedBy: string[];
}

/**
 * Works out how a room's beds must change for a new capacity.
 *
 * Growing only ever appends: existing beds keep their label, status and rent
 * override, because a bed is a real place a real tenant sleeps — renumbering it
 * would silently move people.
 *
 * Shrinking removes the highest labels, and is refused outright if any of them
 * is occupied. Reported rather than thrown so the route can answer 409 with the
 * specific beds an owner needs to free.
 */
export function reconcileBeds(
  existing: ExistingBed[],
  capacity: number,
): BedReconciliation {
  const target = bedLabelsForCapacity(capacity);
  const targetSet = new Set(target);

  const present = new Set(existing.map((bed) => bed.number));
  const toCreate = target.filter((label) => !present.has(label));

  const surplus = existing.filter((bed) => !targetSet.has(bed.number));
  const blockedBy = surplus
    .filter((bed) => bed.status === "occupied")
    .map((bed) => bed.number)
    .sort();

  return {
    toCreate,
    toDelete: blockedBy.length > 0 ? [] : surplus.map((bed) => bed.number).sort(),
    blockedBy,
  };
}
