// src/index.ts
import pino3 from "pino";

// src/queues/billing.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
var logger = pino({ level: "info" });
var connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.includes("upstash.io") ? {} : void 0
});
var billingQueue = new Queue("billing", { connection });
var billingWorker = new Worker(
  "billing",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing billing job");
    const { propertyId, month } = job.data;
    return { propertyId, month, billsGenerated: 0 };
  },
  { connection }
);
billingWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Billing job completed");
});
billingWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Billing job failed");
});

// src/queues/reminders.ts
import { Queue as Queue2, Worker as Worker2 } from "bullmq";
import IORedis2 from "ioredis";
import pino2 from "pino";
var logger2 = pino2({ level: "info" });
var connection2 = new IORedis2(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.includes("upstash.io") ? {} : void 0
});
var reminderQueue = new Queue2("reminders", { connection: connection2 });
var reminderWorker = new Worker2(
  "reminders",
  async (job) => {
    logger2.info({ jobId: job.id, data: job.data }, "Processing reminder job");
    const { tenantId, billId, channel } = job.data;
    return { tenantId, billId, channel, status: "sent" };
  },
  { connection: connection2 }
);
reminderWorker.on("completed", (job) => {
  logger2.info({ jobId: job.id }, "Reminder job completed");
});
reminderWorker.on("failed", (job, err) => {
  logger2.error({ jobId: job?.id, err }, "Reminder job failed");
});

// src/index.ts
var logger3 = pino3({ level: "info" });
logger3.info("Worker started with queues: billing, reminders");
var shutdown = async () => {
  logger3.info("Shutting down worker");
  await billingWorker.close();
  await reminderWorker.close();
  await billingQueue.close();
  await reminderQueue.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
export {
  billingQueue,
  reminderQueue
};
//# sourceMappingURL=index.js.map