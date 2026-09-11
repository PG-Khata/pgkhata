import pino from "pino";

/**
 * Lives here rather than in index.ts so middleware can log without importing
 * the module that imports it.
 */
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
