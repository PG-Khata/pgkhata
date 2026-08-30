/**
 * Creates bed rows for rooms that existed before the bed table.
 *
 * Occupancy is measured in beds, so a room with no bed rows reads as zero
 * capacity and drags the reported occupancy rate down. Idempotent: only
 * missing labels are inserted, and existing beds keep their status and rent.
 *
 *   pnpm --filter @pgkhata/db backfill:beds
 */
import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { db, pool, room, bed } from "../src/index";

/** Mirrors apps/api/src/lib/beds.ts bedLabel. */
function bedLabel(index: number): string {
  let label = "";
  let remaining = index;
  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

async function main() {
  const rooms = await db
    .select({ id: room.id, number: room.number, capacity: room.capacity })
    .from(room)
    .orderBy(asc(room.number));

  const [totals] = await db.select({ count: sql<number>`count(*)::int` }).from(bed);
  console.log(`Rooms: ${rooms.length}. Existing beds: ${totals?.count ?? 0}.`);

  let created = 0;
  let untouched = 0;

  for (const r of rooms) {
    const existing = await db
      .select({ number: bed.number })
      .from(bed)
      .where(eq(bed.roomId, r.id));

    const present = new Set(existing.map((b) => b.number));
    const missing = Array.from({ length: r.capacity }, (_, i) => bedLabel(i)).filter(
      (label) => !present.has(label),
    );

    if (missing.length === 0) {
      untouched += 1;
      continue;
    }

    await db
      .insert(bed)
      .values(missing.map((label) => ({ roomId: r.id, number: label })));

    created += missing.length;
    console.log(`  room ${r.number}: added ${missing.join(", ")}`);
  }

  console.log(`Created ${created} bed(s). ${untouched} room(s) already complete.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Backfill failed:", error);
    await pool.end();
    process.exit(1);
  });
