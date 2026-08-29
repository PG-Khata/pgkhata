import { and, asc, eq, lte, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { outboxEvents, type Database } from "@pgkhata/db";
import { QUEUE_NAMES, type OutboxJob } from "./queues.js";

export async function publishPendingOutbox(
  db: Database,
  queue: Queue<OutboxJob>,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.status, "pending"), lte(outboxEvents.availableAt, now)))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(100)
      .for("update", { skipLocked: true });

    for (const event of events) {
      await queue.add(
        QUEUE_NAMES.outbox,
        { eventId: event.id },
        {
          jobId: event.deduplicationKey.replace(/[^a-zA-Z0-9_-]/g, "_"),
          attempts: 5,
          backoff: { type: "exponential", delay: 1_000 },
          removeOnComplete: 500,
          removeOnFail: 1_000,
        },
      );
      await tx
        .update(outboxEvents)
        .set({ status: "published", publishedAt: now, attempts: sql`${outboxEvents.attempts} + 1` })
        .where(eq(outboxEvents.id, event.id));
    }
    return events.length;
  });
}
