import express from "express";
import helmet from "helmet";
import cors from "cors";
import pino from "pino";
import { randomUUID } from "crypto";

const app = express();
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"],
});

// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] as string || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      requestId: req.headers["x-request-id"],
    });
  });
  next();
});

// Health endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/ready", async (req, res) => {
  // TODO: Check database and Redis connectivity
  res.json({ status: "ready", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    err,
    requestId: req.headers["x-request-id"],
  });
  res.status(500).json({
    error: "Internal Server Error",
    requestId: req.headers["x-request-id"],
  });
});

export { app, logger };
