import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

const logger = pino({ level: "info" });

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL.includes("upstash.io") ? {} : undefined,
});

export const reminderQueue = new Queue("reminders", { connection });

export const reminderWorker = new Worker(
  "reminders",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing reminder job");

    const { tenantId, billId, channel } = job.data;

    // TODO: Implement actual reminder logic
    // 1. Get tenant and bill info
    // 2. Send email via Resend
    // 3. Send WhatsApp via Meta API
    // 4. Log notification

    return { tenantId, billId, channel, status: "sent" };
  },
  { connection }
);

reminderWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Reminder job completed");
});

reminderWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Reminder job failed");
});
