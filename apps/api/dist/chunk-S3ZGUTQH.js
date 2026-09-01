var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pino from "pino";
import { randomUUID } from "crypto";

// ../../packages/auth/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// ../../packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  account: () => account,
  bill: () => bill,
  complaint: () => complaint,
  electricityReading: () => electricityReading,
  ownerProfile: () => ownerProfile,
  payment: () => payment,
  property: () => property,
  room: () => room,
  session: () => session,
  tenant: () => tenant,
  user: () => user,
  verification: () => verification
});
import { pgTable, text, timestamp, boolean, integer, uuid } from "drizzle-orm/pg-core";
var user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull()
});
var session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
});
var account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull()
});
var verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull()
});
var ownerProfile = pgTable("owner_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }).unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => ownerProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  electricityMode: text("electricity_mode").notNull().default("flat"),
  electricityRatePerUnit: integer("electricity_rate_per_unit"),
  signupToken: text("signup_token").unique(),
  complaintToken: text("complaint_token").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var room = pgTable("room", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  type: text("type").notNull().default("single"),
  capacity: integer("capacity").notNull().default(1),
  monthlyRent: integer("monthly_rent").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var electricityReading = pgTable("electricity_reading", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => room.id, { onDelete: "cascade" }),
  reading: integer("reading").notNull(),
  units: integer("units").notNull().default(0),
  readingDate: timestamp("reading_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  roomId: uuid("room_id").references(() => room.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull().unique(),
  status: text("status").notNull().default("active"),
  joiningDate: timestamp("joining_date").notNull(),
  vacatingDate: timestamp("vacating_date"),
  monthlyRentOverride: integer("monthly_rent_override"),
  deposit: integer("deposit"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var bill = pgTable("bill", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "cascade" }),
  billMonth: text("bill_month").notNull(),
  rentAmount: integer("rent_amount").notNull(),
  electricityAmount: integer("electricity_amount").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  paidAmount: integer("paid_amount").notNull().default(0),
  balance: integer("balance").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bill.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  method: text("method"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var complaint = pgTable("complaint", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  roomNumber: text("room_number"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ../../packages/db/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// ../../packages/email/src/client.ts
import { Resend } from "resend";
var DEFAULT_FROM = "PGKhata <no-reply@pgkhata.com>";
var client;
function resend() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(apiKey);
  }
  return client;
}
async function sendEmail({
  to,
  subject,
  html
}) {
  const { data, error } = await resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to,
    subject,
    html
  });
  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
  return data;
}

// ../../packages/email/src/format.ts
var currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
function formatCurrency(amount) {
  return currencyFormatter.format(amount);
}
var HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

// ../../packages/email/src/templates.ts
var FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
function passwordResetEmail(url) {
  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Reset your password</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 24px;">
        Click the button below to set a new password for your PGKhata account.
      </p>
      <a href="${escapeHtml(url)}" style="display: inline-block; background: #18181b; color: #fafafa; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; text-decoration: none;">
        Reset password
      </a>
      <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}
function billReminderEmail({
  tenantName,
  propertyName,
  month,
  totalAmount,
  balance
}) {
  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Payment reminder</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 16px;">
        Hi ${escapeHtml(tenantName)}, this is a reminder for your pending rent payment at <strong>${escapeHtml(propertyName)}</strong> for ${escapeHtml(month)}.
      </p>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 0 0 16px;">
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Total billed</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${escapeHtml(totalAmount)}</td>
        </tr>
        <tr style="border-top: 1px solid #e4e4e7;">
          <td style="padding: 8px 0; color: #71717a;">Balance due</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${escapeHtml(balance)}</td>
        </tr>
      </table>
      <p style="font-size: 14px; color: #52525b; margin: 0;">
        Please contact your property owner to make the payment.
      </p>
    </div>
  `;
}

// ../../packages/auth/src/owner-profile.ts
async function ensureOwnerProfile(database, userId) {
  const inserted = await database.insert(ownerProfile).values({ userId }).onConflictDoNothing({ target: ownerProfile.userId }).returning();
  const row = inserted[0];
  return { ownerId: row?.id, created: Boolean(row) };
}

// ../../packages/auth/src/auth.ts
var auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user: user2, url }) => {
      await sendEmail({
        to: user2.email,
        subject: "Reset your PGKhata password",
        html: passwordResetEmail(url)
      });
    }
  },
  databaseHooks: {
    user: {
      create: {
        // Every owner-scoped route resolves the caller through `owner_profile`.
        // Provision it here so a new owner is not met with 403 on every page.
        after: async (user2) => {
          await ensureOwnerProfile(db, user2.id);
        }
      }
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    // 7 days
    updateAge: 60 * 60 * 24
    // 1 day
  },
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:3000"],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001"
});

// src/lib/http.ts
var HttpError = class extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "HttpError";
  }
};
function param(req, name) {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }
  return value;
}
function aggregate(rows, fallback) {
  return rows[0] ?? fallback;
}

// src/routes/properties.ts
import { Router } from "express";
import { z } from "zod";
import { eq as eq2, and } from "drizzle-orm";

// src/middleware/auth.ts
import { eq } from "drizzle-orm";
async function requireAuth(req, res, next) {
  try {
    const session2 = await auth.api.getSession({
      headers: req.headers
    });
    if (!session2) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = {
      id: session2.user.id,
      email: session2.user.email,
      name: session2.user.name
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}
async function requireOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const [profile] = await db.select().from(ownerProfile).where(eq(ownerProfile.userId, req.user.id)).limit(1);
    if (!profile) {
      return res.status(403).json({ error: "Owner profile not found" });
    }
    req.ownerId = profile.id;
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// src/routes/properties.ts
var router = Router();
var createPropertySchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  electricityMode: z.enum(["flat", "meter"]).default("flat"),
  electricityRatePerUnit: z.number().optional()
});
var updatePropertySchema = createPropertySchema.partial();
router.get("/", requireAuth, requireOwner, async (req, res) => {
  try {
    const properties = await db.select().from(property).where(eq2(property.ownerId, req.ownerId));
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
router.get("/:id", requireAuth, requireOwner, async (req, res) => {
  try {
    const [prop] = await db.select().from(property).where(
      and(
        eq2(property.id, param(req, "id")),
        eq2(property.ownerId, req.ownerId)
      )
    ).limit(1);
    if (!prop) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(prop);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch property" });
  }
});
router.post("/", requireAuth, requireOwner, async (req, res) => {
  try {
    const body = createPropertySchema.parse(req.body);
    const [newProperty] = await db.insert(property).values({
      ...body,
      ownerId: req.ownerId
    }).returning();
    res.status(201).json(newProperty);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create property" });
  }
});
router.put("/:id", requireAuth, requireOwner, async (req, res) => {
  try {
    const body = updatePropertySchema.parse(req.body);
    const [updated] = await db.update(property).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(
      and(
        eq2(property.id, param(req, "id")),
        eq2(property.ownerId, req.ownerId)
      )
    ).returning();
    if (!updated) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update property" });
  }
});
router.delete("/:id", requireAuth, requireOwner, async (req, res) => {
  try {
    const [deleted] = await db.delete(property).where(
      and(
        eq2(property.id, param(req, "id")),
        eq2(property.ownerId, req.ownerId)
      )
    ).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete property" });
  }
});
var properties_default = router;

// src/routes/rooms.ts
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
import { eq as eq4, and as and3 } from "drizzle-orm";

// src/middleware/property.ts
import { eq as eq3, and as and2 } from "drizzle-orm";
async function requireProperty(req, res, next) {
  try {
    const propertyId = param(req, "propertyId");
    const [prop] = await db.select().from(property).where(
      and2(eq3(property.id, propertyId), eq3(property.ownerId, req.ownerId))
    ).limit(1);
    if (!prop) {
      return res.status(404).json({ error: "Property not found" });
    }
    req.propertyId = prop.id;
    req.property = prop;
    next();
  } catch (error) {
    next(error);
  }
}

// src/routes/rooms.ts
var router2 = Router2({ mergeParams: true });
var createRoomSchema = z2.object({
  number: z2.string().min(1).max(20),
  type: z2.enum(["single", "double", "triple", "dormitory"]).default("single"),
  capacity: z2.number().min(1).max(20).default(1),
  monthlyRent: z2.number().min(0)
});
var updateRoomSchema = createRoomSchema.partial();
router2.use(requireAuth, requireOwner, requireProperty);
router2.get("/", async (req, res) => {
  try {
    const rooms = await db.select().from(room).where(eq4(room.propertyId, req.propertyId));
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});
router2.get("/:roomId", async (req, res) => {
  try {
    const [r] = await db.select().from(room).where(
      and3(
        eq4(room.id, param(req, "roomId")),
        eq4(room.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!r) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(r);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch room" });
  }
});
router2.post("/", async (req, res) => {
  try {
    const body = createRoomSchema.parse(req.body);
    const [existing] = await db.select().from(room).where(
      and3(
        eq4(room.propertyId, req.propertyId),
        eq4(room.number, body.number)
      )
    ).limit(1);
    if (existing) {
      return res.status(409).json({ error: "Room number already exists" });
    }
    const [newRoom] = await db.insert(room).values({
      ...body,
      propertyId: req.propertyId
    }).returning();
    res.status(201).json(newRoom);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create room" });
  }
});
router2.put("/:roomId", async (req, res) => {
  try {
    const body = updateRoomSchema.parse(req.body);
    const [updated] = await db.update(room).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(
      and3(
        eq4(room.id, param(req, "roomId")),
        eq4(room.propertyId, req.propertyId)
      )
    ).returning();
    if (!updated) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update room" });
  }
});
router2.delete("/:roomId", async (req, res) => {
  try {
    const [deleted] = await db.delete(room).where(
      and3(
        eq4(room.id, param(req, "roomId")),
        eq4(room.propertyId, req.propertyId)
      )
    ).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});
var rooms_default = router2;

// src/routes/tenants.ts
import { Router as Router3 } from "express";
import { z as z3 } from "zod";
import { eq as eq5, and as and4, sql } from "drizzle-orm";
var router3 = Router3({ mergeParams: true });
var createTenantSchema = z3.object({
  name: z3.string().min(1).max(100),
  email: z3.string().email().optional(),
  phone: z3.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  roomId: z3.string().uuid().optional(),
  joiningDate: z3.string().transform((str) => new Date(str)),
  monthlyRentOverride: z3.number().min(0).optional(),
  deposit: z3.number().min(0).optional(),
  notes: z3.string().optional()
});
var updateTenantSchema = createTenantSchema.partial().extend({
  status: z3.enum(["active", "vacating", "vacated"]).optional(),
  vacatingDate: z3.string().transform((str) => new Date(str)).optional()
});
router3.use(requireAuth, requireOwner, requireProperty);
router3.get("/", async (req, res) => {
  try {
    const status = req.query.status;
    const where = status ? and4(eq5(tenant.propertyId, req.propertyId), eq5(tenant.status, status)) : eq5(tenant.propertyId, req.propertyId);
    const tenants = await db.select().from(tenant).where(where);
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});
router3.get("/:tenantId", async (req, res) => {
  try {
    const [t] = await db.select().from(tenant).where(
      and4(
        eq5(tenant.id, param(req, "tenantId")),
        eq5(tenant.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!t) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(t);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});
router3.post("/", async (req, res) => {
  try {
    const body = createTenantSchema.parse(req.body);
    const [existingPhone] = await db.select().from(tenant).where(eq5(tenant.phone, body.phone)).limit(1);
    if (existingPhone) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    if (body.roomId) {
      const [r] = await db.select().from(room).where(
        and4(eq5(room.id, body.roomId), eq5(room.propertyId, req.propertyId))
      ).limit(1);
      if (!r) {
        return res.status(404).json({ error: "Room not found" });
      }
      const { count } = aggregate(
        await db.select({ count: sql`count(*)` }).from(tenant).where(and4(eq5(tenant.roomId, body.roomId), eq5(tenant.status, "active"))),
        { count: 0 }
      );
      if (count >= r.capacity) {
        return res.status(409).json({ error: "Room is at full capacity" });
      }
    }
    const [newTenant] = await db.insert(tenant).values({
      ...body,
      propertyId: req.propertyId
    }).returning();
    res.status(201).json(newTenant);
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create tenant" });
  }
});
router3.put("/:tenantId", async (req, res) => {
  try {
    const body = updateTenantSchema.parse(req.body);
    const tenantId = param(req, "tenantId");
    if (body.roomId) {
      const [r] = await db.select().from(room).where(
        and4(eq5(room.id, body.roomId), eq5(room.propertyId, req.propertyId))
      ).limit(1);
      if (!r) {
        return res.status(404).json({ error: "Room not found" });
      }
      const { count } = aggregate(
        await db.select({ count: sql`count(*)` }).from(tenant).where(
          and4(
            eq5(tenant.roomId, body.roomId),
            eq5(tenant.status, "active"),
            sql`${tenant.id} != ${tenantId}`
          )
        ),
        { count: 0 }
      );
      if (count >= r.capacity) {
        return res.status(409).json({ error: "Room is at full capacity" });
      }
    }
    const [updated] = await db.update(tenant).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(
      and4(eq5(tenant.id, tenantId), eq5(tenant.propertyId, req.propertyId))
    ).returning();
    if (!updated) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update tenant" });
  }
});
router3.delete("/:tenantId", async (req, res) => {
  try {
    const [deleted] = await db.delete(tenant).where(
      and4(
        eq5(tenant.id, param(req, "tenantId")),
        eq5(tenant.propertyId, req.propertyId)
      )
    ).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json({ message: "Tenant deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});
var tenants_default = router3;

// src/routes/readings.ts
import { Router as Router4 } from "express";
import { z as z4 } from "zod";
import { eq as eq6, and as and5, desc } from "drizzle-orm";
var router4 = Router4({ mergeParams: true });
var createReadingSchema = z4.object({
  roomId: z4.string().uuid(),
  reading: z4.number().min(0),
  readingDate: z4.string().transform((str) => new Date(str))
});
var listReadingsSchema = z4.object({
  roomId: z4.string().uuid().optional()
});
router4.use(requireAuth, requireOwner, requireProperty);
async function ownedRoom(propertyId, roomId) {
  const [r] = await db.select().from(room).where(and5(eq6(room.id, roomId), eq6(room.propertyId, propertyId))).limit(1);
  return r;
}
router4.get("/", async (req, res) => {
  try {
    const { roomId } = listReadingsSchema.parse(req.query);
    if (roomId) {
      if (!await ownedRoom(req.propertyId, roomId)) {
        return res.status(404).json({ error: "Room not found" });
      }
      const readings2 = await db.select().from(electricityReading).where(eq6(electricityReading.roomId, roomId)).orderBy(desc(electricityReading.readingDate));
      return res.json(readings2);
    }
    const readings = await db.select({
      reading: electricityReading,
      roomNumber: room.number
    }).from(electricityReading).innerJoin(room, eq6(electricityReading.roomId, room.id)).where(eq6(room.propertyId, req.propertyId)).orderBy(desc(electricityReading.readingDate));
    res.json(readings);
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});
router4.post("/", async (req, res) => {
  try {
    const body = createReadingSchema.parse(req.body);
    const r = await ownedRoom(req.propertyId, body.roomId);
    if (!r) return res.status(404).json({ error: "Room not found" });
    const [lastReading] = await db.select().from(electricityReading).where(eq6(electricityReading.roomId, body.roomId)).orderBy(desc(electricityReading.readingDate)).limit(1);
    if (lastReading && body.reading < lastReading.reading) {
      return res.status(400).json({ error: "Reading cannot be less than previous reading" });
    }
    const units = lastReading ? body.reading - lastReading.reading : 0;
    const [newReading] = await db.insert(electricityReading).values({
      roomId: body.roomId,
      reading: body.reading,
      readingDate: body.readingDate,
      units
    }).returning();
    res.status(201).json(newReading);
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create reading" });
  }
});
var readings_default = router4;

// src/routes/billing.ts
import { Router as Router5 } from "express";
import { z as z5 } from "zod";
import { eq as eq7, and as and6, sql as sql2, desc as desc2 } from "drizzle-orm";
var router5 = Router5({ mergeParams: true });
var generateBillsSchema = z5.object({
  month: z5.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM")
});
router5.use(requireAuth, requireOwner, requireProperty);
router5.get("/", async (req, res) => {
  try {
    const month = req.query.month;
    const where = month ? and6(eq7(tenant.propertyId, req.propertyId), eq7(bill.billMonth, month)) : eq7(tenant.propertyId, req.propertyId);
    const bills = await db.select({
      bill,
      tenantName: tenant.name,
      roomNumber: room.number
    }).from(bill).innerJoin(tenant, eq7(bill.tenantId, tenant.id)).leftJoin(room, eq7(tenant.roomId, room.id)).where(where);
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});
router5.post("/generate", async (req, res) => {
  try {
    const { month } = generateBillsSchema.parse(req.body);
    const prop = req.property;
    const activeTenants = await db.select({
      tenant,
      room
    }).from(tenant).leftJoin(room, eq7(tenant.roomId, room.id)).where(and6(eq7(tenant.propertyId, req.propertyId), eq7(tenant.status, "active")));
    const generatedBills = [];
    for (const { tenant: t, room: r } of activeTenants) {
      if (!r) continue;
      const [existing] = await db.select().from(bill).where(and6(eq7(bill.tenantId, t.id), eq7(bill.billMonth, month))).limit(1);
      if (existing) continue;
      const rentAmount = t.monthlyRentOverride ?? r.monthlyRent;
      let electricityAmount = 0;
      if (prop.electricityRatePerUnit) {
        const [reading] = await db.select().from(electricityReading).where(eq7(electricityReading.roomId, r.id)).orderBy(desc2(electricityReading.readingDate)).limit(1);
        if (reading) {
          const { count } = aggregate(
            await db.select({ count: sql2`count(*)` }).from(tenant).where(and6(eq7(tenant.roomId, r.id), eq7(tenant.status, "active"))),
            { count: 0 }
          );
          const occupants = Math.max(1, count);
          electricityAmount = Math.round(
            reading.units * prop.electricityRatePerUnit / occupants
          );
        }
      }
      const totalAmount = rentAmount + electricityAmount;
      const [newBill] = await db.insert(bill).values({
        tenantId: t.id,
        billMonth: month,
        rentAmount,
        electricityAmount,
        totalAmount,
        balance: totalAmount,
        approved: false
      }).returning();
      generatedBills.push(newBill);
    }
    res.status(201).json({
      message: `Generated ${generatedBills.length} bills`,
      bills: generatedBills
    });
  } catch (error) {
    if (error instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate bills" });
  }
});
router5.post("/approve", async (req, res) => {
  try {
    const { billIds } = z5.object({ billIds: z5.array(z5.string().uuid()) }).parse(req.body);
    const approved = await db.update(bill).set({ approved: true, updatedAt: /* @__PURE__ */ new Date() }).where(sql2`${bill.id} = ANY(${billIds})`).returning();
    res.json({ message: `Approved ${approved.length} bills`, bills: approved });
  } catch (error) {
    if (error instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to approve bills" });
  }
});
var billing_default = router5;

// src/routes/payments.ts
import { Router as Router6 } from "express";
import { z as z6 } from "zod";
import { eq as eq8, and as and7, sql as sql3 } from "drizzle-orm";
var router6 = Router6({ mergeParams: true });
var recordPaymentSchema = z6.object({
  billId: z6.string().uuid(),
  amount: z6.number().min(1),
  paymentDate: z6.string().transform((str) => new Date(str)),
  method: z6.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
  notes: z6.string().optional()
});
router6.use(requireAuth, requireOwner, requireProperty);
async function syncBillTotals(billId, totalAmount) {
  const { totalPaid } = aggregate(
    await db.select({ totalPaid: sql3`coalesce(sum(${payment.amount}), 0)` }).from(payment).where(eq8(payment.billId, billId)),
    { totalPaid: 0 }
  );
  const newBalance = totalAmount - totalPaid;
  const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
  await db.update(bill).set({
    paidAmount: totalPaid,
    balance: Math.max(0, newBalance),
    status: newStatus,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq8(bill.id, billId));
  return { totalPaid, balance: newBalance, status: newStatus };
}
router6.get("/", async (req, res) => {
  try {
    const payments = await db.select({
      payment,
      tenantName: tenant.name,
      billMonth: bill.billMonth
    }).from(payment).innerJoin(bill, eq8(payment.billId, bill.id)).innerJoin(tenant, eq8(bill.tenantId, tenant.id)).where(eq8(tenant.propertyId, req.propertyId));
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});
router6.post("/", async (req, res) => {
  try {
    const body = recordPaymentSchema.parse(req.body);
    const [b] = await db.select({ bill }).from(bill).innerJoin(tenant, eq8(bill.tenantId, tenant.id)).where(
      and7(eq8(bill.id, body.billId), eq8(tenant.propertyId, req.propertyId))
    ).limit(1);
    if (!b) return res.status(404).json({ error: "Bill not found" });
    const [newPayment] = await db.insert(payment).values(body).returning();
    await syncBillTotals(body.billId, b.bill.totalAmount);
    res.status(201).json(newPayment);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record payment" });
  }
});
router6.delete("/:paymentId", async (req, res) => {
  try {
    const [deleted] = await db.delete(payment).where(eq8(payment.id, param(req, "paymentId"))).returning();
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    const [b] = await db.select().from(bill).where(eq8(bill.id, deleted.billId)).limit(1);
    if (b) {
      await syncBillTotals(b.id, b.totalAmount);
    }
    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});
var payments_default = router6;

// src/routes/dashboard.ts
import { Router as Router7 } from "express";
import { eq as eq9, and as and8, sql as sql4, inArray } from "drizzle-orm";
var router7 = Router7();
function currentMonth() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
}
router7.get("/owner", requireAuth, requireOwner, async (req, res) => {
  try {
    const properties = await db.select().from(property).where(eq9(property.ownerId, req.ownerId));
    const propertyIds = properties.map((p) => p.id);
    if (propertyIds.length === 0) {
      return res.json({
        totalProperties: 0,
        totalRooms: 0,
        totalTenants: 0,
        occupancyRate: 0,
        monthlyCollection: 0,
        pendingRent: 0,
        overdueRent: 0
      });
    }
    const { roomCount } = aggregate(
      await db.select({ roomCount: sql4`count(*)` }).from(room).where(inArray(room.propertyId, propertyIds)),
      { roomCount: 0 }
    );
    const { activeTenants } = aggregate(
      await db.select({ activeTenants: sql4`count(*)` }).from(tenant).where(
        and8(inArray(tenant.propertyId, propertyIds), eq9(tenant.status, "active"))
      ),
      { activeTenants: 0 }
    );
    const month = currentMonth();
    const { totalBilled } = aggregate(
      await db.select({ totalBilled: sql4`coalesce(sum(${bill.totalAmount}), 0)` }).from(bill).innerJoin(tenant, eq9(bill.tenantId, tenant.id)).where(
        and8(inArray(tenant.propertyId, propertyIds), eq9(bill.billMonth, month))
      ),
      { totalBilled: 0 }
    );
    const { totalPaid } = aggregate(
      await db.select({ totalPaid: sql4`coalesce(sum(${bill.paidAmount}), 0)` }).from(bill).innerJoin(tenant, eq9(bill.tenantId, tenant.id)).where(
        and8(inArray(tenant.propertyId, propertyIds), eq9(bill.billMonth, month))
      ),
      { totalPaid: 0 }
    );
    const { overdueAmount } = aggregate(
      await db.select({ overdueAmount: sql4`coalesce(sum(${bill.balance}), 0)` }).from(bill).innerJoin(tenant, eq9(bill.tenantId, tenant.id)).where(
        and8(inArray(tenant.propertyId, propertyIds), eq9(bill.status, "overdue"))
      ),
      { overdueAmount: 0 }
    );
    res.json({
      totalProperties: properties.length,
      totalRooms: roomCount,
      totalTenants: activeTenants,
      occupancyRate: roomCount > 0 ? Math.round(activeTenants / roomCount * 100) : 0,
      monthlyCollection: totalPaid,
      pendingRent: totalBilled - totalPaid,
      overdueRent: overdueAmount
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});
router7.get(
  "/property/:propertyId",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const prop = req.property;
      const { roomCount } = aggregate(
        await db.select({ roomCount: sql4`count(*)` }).from(room).where(eq9(room.propertyId, prop.id)),
        { roomCount: 0 }
      );
      const { activeTenants } = aggregate(
        await db.select({ activeTenants: sql4`count(*)` }).from(tenant).where(and8(eq9(tenant.propertyId, prop.id), eq9(tenant.status, "active"))),
        { activeTenants: 0 }
      );
      const month = currentMonth();
      const { totalBilled } = aggregate(
        await db.select({ totalBilled: sql4`coalesce(sum(${bill.totalAmount}), 0)` }).from(bill).innerJoin(tenant, eq9(bill.tenantId, tenant.id)).where(and8(eq9(tenant.propertyId, prop.id), eq9(bill.billMonth, month))),
        { totalBilled: 0 }
      );
      const { totalPaid } = aggregate(
        await db.select({ totalPaid: sql4`coalesce(sum(${bill.paidAmount}), 0)` }).from(bill).innerJoin(tenant, eq9(bill.tenantId, tenant.id)).where(and8(eq9(tenant.propertyId, prop.id), eq9(bill.billMonth, month))),
        { totalPaid: 0 }
      );
      res.json({
        property: prop,
        totalRooms: roomCount,
        activeTenants,
        occupancyRate: roomCount > 0 ? Math.round(activeTenants / roomCount * 100) : 0,
        monthlyBilled: totalBilled,
        monthlyCollected: totalPaid,
        monthlyPending: totalBilled - totalPaid
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property dashboard" });
    }
  }
);
var dashboard_default = router7;

// src/routes/reminders.ts
import { Router as Router8 } from "express";
import { z as z7 } from "zod";
import { eq as eq10, and as and9, sql as sql5 } from "drizzle-orm";
var router8 = Router8({ mergeParams: true });
var sendReminderSchema = z7.object({
  billIds: z7.array(z7.string().uuid()),
  channel: z7.enum(["email", "whatsapp", "both"]).default("email")
});
router8.use(requireAuth, requireOwner, requireProperty);
router8.post("/send", async (req, res) => {
  try {
    const { billIds, channel } = sendReminderSchema.parse(req.body);
    const billsToSend = await db.select({
      bill,
      tenant
    }).from(bill).innerJoin(tenant, eq10(bill.tenantId, tenant.id)).where(and9(
      sql5`${bill.id} = ANY(${billIds})`,
      eq10(tenant.propertyId, req.propertyId)
    ));
    const prop = req.property;
    const results = [];
    for (const { bill: b, tenant: t } of billsToSend) {
      if (!t) continue;
      if (channel === "email" || channel === "both") {
        if (t.email) {
          try {
            await sendEmail({
              to: t.email,
              subject: `Payment reminder \u2014 ${prop?.name || "Your PG"}`,
              html: billReminderEmail({
                tenantName: t.name,
                propertyName: prop?.name || "Your PG",
                month: b.billMonth,
                totalAmount: formatCurrency(b.totalAmount),
                balance: formatCurrency(b.balance)
              })
            });
            results.push({
              billId: b.id,
              tenantId: t.id,
              tenantName: t.name,
              channel: "email",
              status: "sent"
            });
          } catch {
            results.push({
              billId: b.id,
              tenantId: t.id,
              tenantName: t.name,
              channel: "email",
              status: "failed"
            });
          }
        } else {
          results.push({
            billId: b.id,
            tenantId: t.id,
            tenantName: t.name,
            channel: "email",
            status: "skipped",
            reason: "No email on file"
          });
        }
      }
      if (channel === "whatsapp" || channel === "both") {
        results.push({
          billId: b.id,
          tenantId: t.id,
          tenantName: t.name,
          channel: "whatsapp",
          status: "not_implemented"
        });
      }
    }
    res.json({
      message: `Processed ${results.length} reminders`,
      results
    });
  } catch (error) {
    if (error instanceof z7.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to send reminders" });
  }
});
var reminders_default = router8;

// src/routes/public.ts
import { Router as Router9 } from "express";
import { z as z8 } from "zod";
import { eq as eq11, and as and10, sql as sql6 } from "drizzle-orm";
var router9 = Router9();
var signupSchema = z8.object({
  name: z8.string().min(1).max(100),
  phone: z8.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  email: z8.string().email().optional(),
  roomId: z8.string().uuid()
});
var complaintSchema = z8.object({
  subject: z8.string().min(1).max(200),
  description: z8.string().min(1).max(1e3),
  roomNumber: z8.string().optional()
});
router9.get("/signup/:token", async (req, res) => {
  try {
    const [prop] = await db.select().from(property).where(eq11(property.signupToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid signup link" });
    const vacantRooms = await db.select({
      id: room.id,
      number: room.number,
      type: room.type
    }).from(room).where(eq11(room.propertyId, prop.id));
    res.json({
      propertyName: prop.name,
      rooms: vacantRooms
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signup data" });
  }
});
router9.post("/signup/:token", async (req, res) => {
  try {
    const body = signupSchema.parse(req.body);
    const [prop] = await db.select().from(property).where(eq11(property.signupToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid signup link" });
    const [r] = await db.select().from(room).where(and10(eq11(room.id, body.roomId), eq11(room.propertyId, prop.id))).limit(1);
    if (!r) return res.status(404).json({ error: "Room not found" });
    const { count } = aggregate(
      await db.select({ count: sql6`count(*)` }).from(tenant).where(and10(eq11(tenant.roomId, body.roomId), eq11(tenant.status, "active"))),
      { count: 0 }
    );
    if (count >= r.capacity) {
      return res.status(409).json({ error: "Room is full" });
    }
    const [existing] = await db.select().from(tenant).where(eq11(tenant.phone, body.phone)).limit(1);
    if (existing) {
      return res.status(409).json({ error: "Phone already registered" });
    }
    const [newTenant] = await db.insert(tenant).values({
      propertyId: prop.id,
      roomId: body.roomId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      joiningDate: /* @__PURE__ */ new Date(),
      status: "active"
    }).returning();
    res.status(201).json({ message: "Signup successful", tenant: newTenant });
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to process signup" });
  }
});
router9.get("/complaint/:token", async (req, res) => {
  try {
    const [prop] = await db.select().from(property).where(eq11(property.complaintToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });
    res.json({ propertyName: prop.name });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaint data" });
  }
});
router9.post("/complaint/:token", async (req, res) => {
  try {
    const body = complaintSchema.parse(req.body);
    const [prop] = await db.select().from(property).where(eq11(property.complaintToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });
    const [newComplaint] = await db.insert(complaint).values({
      propertyId: prop.id,
      subject: body.subject,
      description: body.description,
      roomNumber: body.roomNumber,
      status: "open"
    }).returning();
    res.status(201).json({ message: "Complaint submitted", complaint: newComplaint });
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});
var public_default = router9;

// src/routes/subscriptions.ts
import { Router as Router10 } from "express";
import { z as z9 } from "zod";
var router10 = Router10();
var PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 0,
    maxProperties: 1,
    maxRooms: 15,
    features: ["Basic billing", "Email reminders"]
  },
  growing: {
    id: "growing",
    name: "Growing",
    price: 499,
    maxProperties: 5,
    maxRooms: 40,
    features: ["WhatsApp reminders", "Reports", "CSV export"]
  },
  scale: {
    id: "scale",
    name: "Scale",
    price: 999,
    maxProperties: 15,
    maxRooms: 200,
    features: ["Priority support", "API access", "Custom branding"]
  }
};
router10.get("/plans", async (req, res) => {
  res.json(Object.values(PLANS));
});
router10.get("/current", requireAuth, requireOwner, async (req, res) => {
  res.json({
    plan: PLANS.starter,
    status: "active",
    expiresAt: null
  });
});
router10.post("/checkout", requireAuth, requireOwner, async (req, res) => {
  try {
    const { planId } = z9.object({ planId: z9.enum(["growing", "scale"]) }).parse(req.body);
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: "Invalid plan" });
    res.json({
      orderId: "placeholder_order_id",
      amount: plan.price,
      currency: "INR",
      plan
    });
  } catch (error) {
    if (error instanceof z9.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create checkout" });
  }
});
router10.post("/verify", requireAuth, requireOwner, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = z9.object({
      orderId: z9.string(),
      paymentId: z9.string(),
      signature: z9.string()
    }).parse(req.body);
    res.json({ verified: true, message: "Payment verified" });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
});
var subscriptions_default = router10;

// src/routes/admin.ts
import { Router as Router11 } from "express";
import { eq as eq12, sql as sql7 } from "drizzle-orm";
var router11 = Router11();
async function requireSuperAdmin(req, res, next) {
  next();
}
router11.get("/overview", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { userCount } = aggregate(
      await db.select({ userCount: sql7`count(*)` }).from(user),
      { userCount: 0 }
    );
    const { ownerCount } = aggregate(
      await db.select({ ownerCount: sql7`count(*)` }).from(ownerProfile),
      { ownerCount: 0 }
    );
    const { propertyCount } = aggregate(
      await db.select({ propertyCount: sql7`count(*)` }).from(property),
      { propertyCount: 0 }
    );
    const { tenantCount } = aggregate(
      await db.select({ tenantCount: sql7`count(*)` }).from(tenant).where(eq12(tenant.status, "active")),
      { tenantCount: 0 }
    );
    res.json({
      totalUsers: userCount,
      totalOwners: ownerCount,
      totalProperties: propertyCount,
      activeTenants: tenantCount
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});
router11.get("/owners", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const owners = await db.select({
      owner: ownerProfile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }).from(ownerProfile).leftJoin(user, eq12(ownerProfile.userId, user.id));
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});
router11.get("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const ownerId = param(req, "ownerId");
    const [owner] = await db.select({
      owner: ownerProfile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }).from(ownerProfile).leftJoin(user, eq12(ownerProfile.userId, user.id)).where(eq12(ownerProfile.id, ownerId)).limit(1);
    if (!owner) return res.status(404).json({ error: "Owner not found" });
    const properties = await db.select().from(property).where(eq12(property.ownerId, ownerId));
    res.json({ ...owner, properties });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owner" });
  }
});
var admin_default = router11;

// src/index.ts
var app = express();
var logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"]
});
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
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
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : void 0
      });
      const response = await auth.handler(request);
      res.status(response.status);
      response.headers.forEach((value, key) => {
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
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      requestId: req.headers["x-request-id"]
    });
  });
  next();
});
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/ready", async (req, res) => {
  res.json({ status: "ready", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/v1/me", async (req, res) => {
  const session2 = await auth.api.getSession({
    headers: req.headers
  });
  if (!session2) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: session2.user, session: session2.session });
});
app.use("/v1/properties", properties_default);
app.use("/v1/properties/:propertyId/rooms", rooms_default);
app.use("/v1/properties/:propertyId/tenants", tenants_default);
app.use("/v1/properties/:propertyId/readings", readings_default);
app.use("/v1/properties/:propertyId/bills", billing_default);
app.use("/v1/properties/:propertyId/payments", payments_default);
app.use("/v1/properties/:propertyId/reminders", reminders_default);
app.use("/v1/dashboard", dashboard_default);
app.use("/v1/subscriptions", subscriptions_default);
app.use("/v1/admin", admin_default);
app.use("/public", public_default);
app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) {
    logger.error({ err, requestId: req.headers["x-request-id"] });
  } else {
    logger.warn({ err: err.message, requestId: req.headers["x-request-id"] });
  }
  res.status(status).json({
    error: status >= 500 ? "Internal Server Error" : err.message,
    ...err instanceof HttpError && err.details ? { details: err.details } : {},
    requestId: req.headers["x-request-id"]
  });
});

export {
  app,
  logger
};
//# sourceMappingURL=chunk-S3ZGUTQH.js.map