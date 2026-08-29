import pino from "pino";
import { billingQueue, billingWorker } from "./queues/billing";
import { reminderQueue, reminderWorker } from "./queues/reminders";

const logger = pino({ level: "info" });

logger.info("Worker started with queues: billing, reminders");

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down worker");
  await billingWorker.close();
  await reminderWorker.close();
  await billingQueue.close();
  await reminderQueue.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { billingQueue, reminderQueue };
