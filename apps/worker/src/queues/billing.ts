import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

const logger = pino({ level: "info" });

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.includes("upstash.io") ? {} : undefined,
});

export const billingQueue = new Queue("billing", { connection });

export const billingWorker = new Worker(
  "billing",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing billing job");

    const { propertyId, month } = job.data;

    // TODO: Implement actual billing logic
    // 1. Get all active tenants for property
    // 2. Calculate rent + electricity
    // 3. Create bills with idempotency
    // 4. Queue notifications

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
