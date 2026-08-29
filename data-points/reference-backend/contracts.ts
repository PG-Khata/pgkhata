import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime();

export const problemSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string(),
  errors: z.record(z.array(z.string())).optional(),
});
export type ApiProblem = z.infer<typeof problemSchema>;

export const workspaceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(80),
  createdAt: isoDateTimeSchema,
});

export const propertySchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string().min(1).max(120),
  address: z.string().max(500).nullable(),
  city: z.string().max(100).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createPropertySchema = propertySchema
  .pick({ name: true, address: true, city: true })
  .extend({
    address: z.string().trim().max(500).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
  });
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type Property = z.infer<typeof propertySchema>;

export const propertyListSchema = z.object({
  data: z.array(propertySchema),
  nextCursor: z.string().nullable(),
});

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  version: z.string(),
  checks: z.record(z.enum(["up", "down"])).optional(),
});
