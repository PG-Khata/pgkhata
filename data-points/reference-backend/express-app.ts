import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { healthSchema } from "@pgkhata/contracts";
import { createPropertyRouter } from "./modules/properties/routes.js";
import { errorHandler, notFound } from "./errors.js";
import type { ApiDependencies } from "./types.js";

export function createApp(dependencies: ApiDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((request, response, next) => {
    request.requestId = request.get("x-request-id")?.slice(0, 128) || randomUUID();
    response.setHeader("x-request-id", request.requestId);
    next();
  });
  app.use(pinoHttp({ logger: dependencies.logger, genReqId: (request) => request.requestId }));
  app.use(helmet());
  app.use(
    cors({
      origin: dependencies.webOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }),
  );

  app.get("/health/live", (_request, response) => {
    response.json(
      healthSchema.parse({ status: "ok", service: "pgkhata-api", version: dependencies.buildSha }),
    );
  });
  app.get("/health/ready", async (_request, response, next) => {
    try {
      const ready = await dependencies.ready();
      response.status(ready ? 200 : 503).json(
        healthSchema.parse({
          status: ready ? "ok" : "degraded",
          service: "pgkhata-api",
          version: dependencies.buildSha,
          checks: { database: ready ? "up" : "down" },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1/properties", createPropertyRouter(dependencies));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
