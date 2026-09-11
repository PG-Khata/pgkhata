import express from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { auth } from "@pgkhata/auth";
import { pool } from "@pgkhata/db";
import { HttpError } from "./lib/http";
import { validatePaginationQuery } from "./lib/pagination";
import { logger } from "./lib/logger";
import { resolveImpersonation, enforceImpersonationReadOnly } from "./middleware/impersonation";
import { auditPrivilegedWrites } from "./middleware/audit";
import impersonationRouter from "./routes/impersonation";
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
import profileRouter from "./routes/profile";
import publicRouter from "./routes/public";
import adminRouter from "./routes/admin";
import emergencyContactsRouter from "./routes/emergency-contacts";
import bedBookingsRouter from "./routes/bed-bookings";
import staffRouter from "./routes/staff";
import exportsRouter from "./routes/exports";
import amenitiesRouter from "./routes/amenities";
import billingPolicyRouter from "./routes/billing-policy";
import notificationPreferencesRouter from "./routes/notification-preferences";
import notificationsRouter from "./routes/notifications";
import tenantDocumentsRouter from "./routes/tenant-documents";
import adminDocumentsRouter from "./routes/admin-documents";
import permissionsRouter from "./routes/permissions";
import structureRouter from "./routes/structure";
import whatsappRouter from "./routes/whatsapp";
import policeVerificationRouter from "./routes/police-verification";

const app = express();

// Request ID middleware
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Security middleware
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
if (!process.env.CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN environment variable is required");
}
app.use(
  cors({
    // Split, because CORS_ORIGIN carries every allowed origin (owner app, admin
    // console) comma-separated — which is how better-auth already reads it in
    // packages/auth/src/security-policy.ts. Handing the raw string to `cors`
    // makes it an exact match against the Origin header, so the moment a second
    // origin is added the joined value matches neither and every browser call
    // fails CORS.
    origin: process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
  })
);

// Body parsing - needed for auth
app.use(express.json({ limit: "10mb" }));
app.use(validatePaginationQuery);

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
      if (response.status >= 500) {
        logger.error(
          {
            authStatus: response.status,
            authResponse: body || undefined,
            requestId: req.headers["x-request-id"],
          },
          "Better Auth returned a server error",
        );
      }
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

// Impersonation, mounted globally and before every router.
//
// Owner routers are mounted individually below, so anything scoped per-router
// is one forgotten `router.use` away from a tenancy bypass or a write slipping
// through a read-only session. Position matters: this sits AFTER the /api/auth
// block above, which returns without calling next() — that is what keeps
// better-auth unreachable to an impersonated browser, so an admin cannot change
// the owner's password. Preserve that ordering.
app.use(resolveImpersonation);
app.use(enforceImpersonationReadOnly);
app.use(auditPrivilegedWrites);

// Health endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/ready", async (req, res) => {
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database readiness timeout")), 2_000)),
    ]);
    res.json({ status: "ready", timestamp: new Date().toISOString() });
  } catch (error) {
    logger.warn({ err: error, requestId: req.headers["x-request-id"] }, "Readiness check failed");
    res.status(503).json({ status: "not_ready", timestamp: new Date().toISOString() });
  }
});

// Protected endpoint example
app.get("/v1/me", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ user: session.user, session: session.session });
  } catch (error) {
    logger.warn({ err: error, requestId: req.headers["x-request-id"] }, "Session lookup failed");
    res.status(503).json({ error: "Authentication service temporarily unavailable" });
  }
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
app.use("/v1/properties/:propertyId/emergency-contacts", emergencyContactsRouter);
app.use("/v1/properties/:propertyId/bed-bookings", bedBookingsRouter);
app.use("/v1/properties/:propertyId/staff", staffRouter);
app.use("/v1/properties/:propertyId/exports", exportsRouter);
app.use("/v1/properties/:propertyId/amenities", amenitiesRouter);
app.use("/v1/properties/:propertyId/billing-policy", billingPolicyRouter);
app.use("/v1/properties/:propertyId/notification-preferences", notificationPreferencesRouter);
app.use("/v1/notifications", notificationsRouter);
app.use("/v1/properties/:propertyId/tenant-documents", tenantDocumentsRouter);
app.use("/v1/properties/:propertyId/admin-documents", adminDocumentsRouter);
app.use("/v1/properties/:propertyId/permissions", permissionsRouter);
app.use("/v1/properties/:propertyId/structure", structureRouter);
app.use("/v1/properties/:propertyId/whatsapp", whatsappRouter);
app.use("/v1/properties/:propertyId/police-verification", policeVerificationRouter);
app.use("/v1/profile", profileRouter);
app.use("/v1/dashboard", dashboardRouter);
app.use("/v1/admin", adminRouter);
app.use("/v1/impersonation", impersonationRouter);

// Public routes (no auth required)
app.use("/public", publicRouter);

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    requestId: req.headers["x-request-id"],
  });
});

// Error handling
app.use((err: Error & { type?: string; status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err instanceof HttpError
    ? err.status
    : err.type === "entity.too.large" || err.status === 413
      ? 413
      : err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400)
        ? 400
        : 500;

  if (status >= 500) {
    logger.error({ err, requestId: req.headers["x-request-id"] });
  } else {
    logger.warn({ err: err.message, requestId: req.headers["x-request-id"] });
  }

  res.status(status).json({
    error: status === 413
      ? "Request body is too large"
      : status === 400
        ? "Malformed JSON request body"
        : status >= 500
          ? "Internal Server Error"
          : err.message,
    ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
    requestId: req.headers["x-request-id"],
  });
});

export { app, logger };
