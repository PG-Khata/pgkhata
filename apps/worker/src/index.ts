import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

// Upstash Redis connection (requires TLS)
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: process.env.REDIS_URL?.includes("upstash.io") ? {} : undefined,
});

// Example queue - will be expanded in Task 12
const exampleQueue = new Queue("example", { connection });

const exampleWorker = new Worker(
  "example",
  async (job) => {
    logger.info({ jobId: job.id }, "Processing job");
    // Job processing logic will be added later
  },
  { connection }
);

exampleWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});

exampleWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Job failed");
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down worker");
  await exampleWorker.close();
  await exampleQueue.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("Worker started");

export { exampleQueue, exampleWorker, connection };
