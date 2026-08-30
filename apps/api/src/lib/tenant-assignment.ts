import { db, bed, room, tenant } from "@pgkhata/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  FREED,
  OCCUPIED,
  assignmentErrorMessage,
  resolveBedForAssignment,
  type AssignableBed,
} from "./assignment";
import { HttpError } from "./http";

/** Beds of a property, with the room they sit in, for assignment decisions. */
async function assignableBeds(propertyId: string): Promise<
  Array<AssignableBed & { roomNumber: string }>
> {
  const rows = await db
    .select({
      id: bed.id,
      roomId: bed.roomId,
      number: bed.number,
      status: bed.status,
      roomNumber: room.number,
    })
    .from(bed)
    .innerJoin(room, eq(bed.roomId, room.id))
    .where(eq(room.propertyId, propertyId));

  return rows;
}

export interface AssignmentOutcome {
  bedId: string;
  roomId: string;
  bedNumber: string;
  roomNumber: string;
}

/**
 * Moves a tenant into a bed and marks the bed occupied in one transaction, so
 * the two can never disagree. Frees the tenant's previous bed in the same
 * transaction when this is a move.
 *
 * The status is re-read `for update` inside the transaction, and
 * `tenant_bed_uq` is the final backstop: two concurrent requests for one bed
 * leave exactly one winner and the loser gets a 409.
 */
export async function assignTenantToBed(
  propertyId: string,
  tenantId: string,
  target: { bedId?: string | null; roomId?: string | null },
): Promise<AssignmentOutcome> {
  const beds = await assignableBeds(propertyId);
  const decision = resolveBedForAssignment(beds, target);

  if (!decision.ok) {
    const roomNumber = beds.find((b) =>
      "bedNumber" in decision ? b.number === decision.bedNumber : false,
    )?.roomNumber;

    const status = decision.reason === "bed-not-found" ? 404 : 409;
    throw new HttpError(status, assignmentErrorMessage(decision, roomNumber));
  }

  const chosen = decision.bed;
  const roomNumber =
    beds.find((b) => b.id === chosen.id)?.roomNumber ?? "";

  try {
    return await db.transaction(async (tx) => {
      // Re-read under a row lock: the pure decision was made on a snapshot.
      const [locked] = await tx
        .select({ id: bed.id, status: bed.status })
        .from(bed)
        .where(eq(bed.id, chosen.id))
        .for("update");

      if (!locked) throw new HttpError(404, "Bed not found");
      if (locked.status !== "vacant") {
        throw new HttpError(
          409,
          `Bed ${roomNumber}-${chosen.number} is no longer available`,
        );
      }

      const [current] = await tx
        .select({ id: tenant.id, bedId: tenant.bedId })
        .from(tenant)
        .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, propertyId)))
        .limit(1);

      if (!current) throw new HttpError(404, "Tenant not found");

      // Free the bed being left behind, so a move never leaves two beds held.
      if (current.bedId && current.bedId !== chosen.id) {
        await tx
          .update(bed)
          .set({ status: FREED, updatedAt: new Date() })
          .where(eq(bed.id, current.bedId));
      }

      await tx
        .update(tenant)
        .set({ bedId: chosen.id, roomId: chosen.roomId, updatedAt: new Date() })
        .where(eq(tenant.id, tenantId));

      await tx
        .update(bed)
        .set({ status: OCCUPIED, updatedAt: new Date() })
        .where(eq(bed.id, chosen.id));

      return {
        bedId: chosen.id,
        roomId: chosen.roomId,
        bedNumber: chosen.number,
        roomNumber,
      };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;

    // tenant_bed_uq: another request won the race for this bed.
    if (isUniqueViolation(error, "tenant_bed_uq")) {
      throw new HttpError(
        409,
        `Bed ${roomNumber}-${chosen.number} was just taken by someone else`,
      );
    }

    throw error;
  }
}

/**
 * Releases whatever bed a tenant holds. Idempotent: a tenant with no bed is a
 * no-op rather than an error, so vacating twice cannot corrupt bed status.
 */
export async function vacateTenantBed(
  propertyId: string,
  tenantId: string,
): Promise<{ freedBedId: string | null }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: tenant.id, bedId: tenant.bedId })
      .from(tenant)
      .where(and(eq(tenant.id, tenantId), eq(tenant.propertyId, propertyId)))
      .limit(1);

    if (!current) throw new HttpError(404, "Tenant not found");
    if (!current.bedId) return { freedBedId: null };

    await tx
      .update(tenant)
      .set({ bedId: null, roomId: null, updatedAt: new Date() })
      .where(eq(tenant.id, tenantId));

    await tx
      .update(bed)
      .set({ status: FREED, updatedAt: new Date() })
      .where(eq(bed.id, current.bedId));

    return { freedBedId: current.bedId };
  });
}

/**
 * Recomputes bed status from the tenants that hold them. Used after bulk
 * changes and by the repair script; occupancy is reported from bed.status, so a
 * drift between the two shows up as a wrong percentage on the dashboard.
 */
export async function reconcileBedStatuses(propertyId: string): Promise<number> {
  const beds = await db
    .select({ id: bed.id, status: bed.status })
    .from(bed)
    .innerJoin(room, eq(bed.roomId, room.id))
    .where(eq(room.propertyId, propertyId));

  if (beds.length === 0) return 0;

  const held = await db
    .select({ bedId: tenant.bedId })
    .from(tenant)
    .where(
      and(
        eq(tenant.propertyId, propertyId),
        inArray(
          tenant.bedId,
          beds.map((b) => b.id),
        ),
      ),
    );

  const heldIds = new Set(held.map((row) => row.bedId).filter(Boolean) as string[]);

  const shouldOccupy = beds
    .filter((b) => heldIds.has(b.id) && b.status !== "occupied")
    .map((b) => b.id);
  const shouldFree = beds
    .filter((b) => !heldIds.has(b.id) && b.status === "occupied")
    .map((b) => b.id);

  if (shouldOccupy.length === 0 && shouldFree.length === 0) return 0;

  await db.transaction(async (tx) => {
    if (shouldOccupy.length > 0) {
      await tx
        .update(bed)
        .set({ status: OCCUPIED, updatedAt: new Date() })
        .where(inArray(bed.id, shouldOccupy));
    }
    if (shouldFree.length > 0) {
      await tx
        .update(bed)
        .set({ status: FREED, updatedAt: new Date() })
        .where(inArray(bed.id, shouldFree));
    }
  });

  return shouldOccupy.length + shouldFree.length;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as { code?: string; constraint?: string; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint === constraint) return true;
    current = candidate.cause;
  }
  return false;
}
