import { z } from "zod";
import "dotenv/config";

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const apiSchema = baseSchema.extend({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
  APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
});

const webSchema = baseSchema.extend({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const workerSchema = baseSchema.extend({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof apiSchema>;
export type WebEnv = z.infer<typeof webSchema>;
export type WorkerEnv = z.infer<typeof workerSchema>;

function validateEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export function getApiEnv(): ApiEnv {
  return validateEnv(apiSchema);
}

export function getWebEnv(): WebEnv {
  return validateEnv(webSchema);
}

export function getWorkerEnv(): WorkerEnv {
  return validateEnv(workerSchema);
}
