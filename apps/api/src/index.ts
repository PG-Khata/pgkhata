import express from "express";
import helmet from "helmet";
import cors from "cors";
import pino from "pino";
import { randomUUID } from "crypto";
import { auth } from "@pgkhata/auth";
import { HttpError } from "./lib/http";
import propertiesRouter from "./routes/properties";
import floorsRouter from "./routes/floors";
import rentPlansRouter from "./routes/rent-plans";
import chargeTypesRouter from "./routes/charge-types";
import roomsRouter from "./routes/rooms";
import bedsRouter from "./routes/beds";
import roomBedsRouter from "./routes/room-beds";
import tenantsRouter from "./routes/tenants";
import readingsRouter from "./routes/readings";
import billingRouter from "./routes/billing";
import paymentsRouter from "./routes/payments";
import advancePaymentsRouter from "./routes/advance-payments";
import securityDepositsRouter from "./routes/security-deposits";
import expensesRouter from "./routes/expenses";
import dashboardRouter from "./routes/dashboard";
import remindersRouter from "./routes/reminders";
import publicRouter from "./routes/public";
import subscriptionsRouter from "./routes/subscriptions";
import adminRouter from "./routes/admin";

const app = express();
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"],
});

// Request ID middleware
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing - needed for auth
app.use(express.json({ limit: "10mb" }));

// Mount Better Auth - use the handler as Express middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      });

      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      });

      const response = await auth.handler(request);
      
      res.status(response.status);
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      
      const body = await response.text();
      res.send(body);
    } catch (error) {
      logger.error({ err: error, requestId: req.headers["x-request-id"] }, "Auth handler error");
      res.status(500).json({ error: "Auth handler error" });
    }
  } else {
    next();
  }
});

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

// Protected endpoint example
app.get("/v1/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: req.headers as Record<string, string>,
  });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: session.user, session: session.session });
});

// API routes
app.use("/v1/properties", propertiesRouter);
app.use("/v1/properties/:propertyId/floors", floorsRouter);
app.use("/v1/properties/:propertyId/rent-plans", rentPlansRouter);
app.use("/v1/properties/:propertyId/charge-types", chargeTypesRouter);
app.use("/v1/properties/:propertyId/rooms/:roomId/beds", roomBedsRouter);
app.use("/v1/properties/:propertyId/rooms", roomsRouter);
app.use("/v1/properties/:propertyId/beds", bedsRouter);
app.use("/v1/properties/:propertyId/tenants", tenantsRouter);
app.use("/v1/properties/:propertyId/readings", readingsRouter);
app.use("/v1/properties/:propertyId/bills", billingRouter);
app.use("/v1/properties/:propertyId/payments", paymentsRouter);
app.use("/v1/properties/:propertyId/advance-payments", advancePaymentsRouter);
app.use("/v1/properties/:propertyId/security-deposits", securityDepositsRouter);
app.use("/v1/properties/:propertyId/expenses", expensesRouter);
app.use("/v1/properties/:propertyId/reminders", remindersRouter);
app.use("/v1/dashboard", dashboardRouter);
app.use("/v1/subscriptions", subscriptionsRouter);
app.use("/v1/admin", adminRouter);

// Public routes (no auth required)
app.use("/public", publicRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;

  if (status >= 500) {
    logger.error({ err, requestId: req.headers["x-request-id"] });
  } else {
    logger.warn({ err: err.message, requestId: req.headers["x-request-id"] });
  }

  res.status(status).json({
    error: status >= 500 ? "Internal Server Error" : err.message,
    ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
    requestId: req.headers["x-request-id"],
  });
});

export { app, logger };
