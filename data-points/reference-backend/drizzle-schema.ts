import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const memberRole = pgEnum("member_role", ["owner", "manager"]);
export const tenantStatus = pgEnum("tenant_status", ["active", "vacated", "notice-period"]);
export const billStatus = pgEnum("bill_status", ["pending", "paid", "partially-paid", "overdue"]);
export const paymentMethod = pgEnum("payment_method", ["UPI", "cash", "bank-transfer", "other"]);
export const jobStatus = pgEnum("job_status", ["pending", "published", "failed"]);

// Better Auth owns its auth tables. Domain tables reference the stable auth user id as text.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  legacyAdminId: uuid("legacy_admin_id").unique(),
  ...timestamps,
});

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: memberRole("role").notNull().default("owner"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_memberships_user_idx").on(table.userId),
  ],
);

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  legacyId: uuid("legacy_id").unique(),
  ...timestamps,
});

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomNumber: text("room_number").notNull(),
    capacity: integer("capacity").notNull().default(1),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull().default("0"),
    legacyId: uuid("legacy_id").unique(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rooms_workspace_property_number_uq").on(
      table.workspaceId,
      table.propertyId,
      table.roomNumber,
    ),
    check("rooms_capacity_positive", sql`${table.capacity} > 0`),
    check("rooms_rent_nonnegative", sql`${table.monthlyRent} >= 0`),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    status: tenantStatus("status").notNull().default("active"),
    joinDate: date("join_date").notNull(),
    monthlyRentOverride: numeric("monthly_rent_override", { precision: 12, scale: 2 }),
    legacyId: uuid("legacy_id").unique(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tenants_workspace_phone_uq").on(table.workspaceId, table.phone),
    check(
      "tenants_rent_override_nonnegative",
      sql`${table.monthlyRentOverride} IS NULL OR ${table.monthlyRentOverride} >= 0`,
    ),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    billMonth: text("bill_month").notNull(),
    rentAmount: numeric("rent_amount", { precision: 12, scale: 2 }).notNull(),
    electricityAmount: numeric("electricity_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    otherCharges: jsonb("other_charges").notNull().default([]),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    status: billStatus("status").notNull().default("pending"),
    approved: boolean("approved").notNull().default(false),
    dueDate: date("due_date").notNull(),
    legacyId: uuid("legacy_id").unique(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bills_workspace_tenant_month_uq").on(
      table.workspaceId,
      table.tenantId,
      table.billMonth,
    ),
    check(
      "bills_amounts_valid",
      sql`${table.totalAmount} >= 0 AND ${table.paidAmount} >= 0 AND ${table.paidAmount} <= ${table.totalAmount}`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: paymentMethod("method").notNull(),
    reference: text("reference"),
    idempotencyKey: text("idempotency_key").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    legacyId: uuid("legacy_id").unique(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("payments_workspace_idempotency_uq").on(table.workspaceId, table.idempotencyKey),
    check("payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("outbox_topic_deduplication_uq").on(table.topic, table.deduplicationKey)],
);

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  memberships: many(workspaceMemberships),
  properties: many(properties),
}));
