import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  uniqueIndex,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Better Auth tables will be generated via CLI
// These are placeholder exports that will be replaced

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// PGKhata domain tables

export const ownerProfile = pgTable("owner_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => ownerProfile.id, { onDelete: "cascade" }),
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
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const floor = pgTable(
  "floor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Display order within the property; lower comes first. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // "Ground floor" twice in one property makes the room grouping ambiguous.
    uniqueIndex("floor_property_name_uq").on(table.propertyId, table.name),
  ],
);

export const rentPlan = pgTable(
  "rent_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monthlyRent: integer("monthly_rent").notNull(),
    securityDeposit: integer("security_deposit"),
    /** Day of the month rent is due; capped at 28 so it exists in every month. */
    dueDay: integer("due_day").notNull().default(1),
    lateFeePerDay: integer("late_fee_per_day"),
    isActive: boolean("is_active").notNull().default(true),
    minStayMonths: integer("min_stay_months"),
    noticePeriodDays: integer("notice_period_days"),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rent_plan_property_name_uq").on(table.propertyId, table.name),
    check("rent_plan_due_day_range", sql`${table.dueDay} between 1 and 28`),
    check("rent_plan_rent_nonnegative", sql`${table.monthlyRent} >= 0`),
    check(
      "rent_plan_late_fee_nonnegative",
      sql`${table.lateFeePerDay} is null or ${table.lateFeePerDay} >= 0`,
    ),
  ],
);

export const chargeType = pgTable(
  "charge_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Short code a bill line item references: ELEC, WATER, MAINT. */
    code: text("code").notNull(),
    defaultAmount: integer("default_amount").notNull().default(0),
    /** Recurring charges (electricity) reappear each billing run; one-off ones don't. */
    isRecurring: boolean("is_recurring").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("charge_type_property_code_uq").on(table.propertyId, table.code),
    check("charge_type_amount_nonnegative", sql`${table.defaultAmount} >= 0`),
  ],
);

export const room = pgTable(
  "room",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    // Nullable: rooms created before floors existed, and properties that never
    // model floors, group under "Unassigned". restrict, so removing a floor
    // cannot silently orphan its rooms.
    floorId: uuid("floor_id").references(() => floor.id, { onDelete: "restrict" }),
    /**
     * Nullable and restrict: a plan in use cannot be deleted out from under a
     * room, but a room need not have one — monthlyRent below is the fallback.
     */
    rentPlanId: uuid("rent_plan_id").references(() => rentPlan.id, {
      onDelete: "restrict",
    }),
    number: text("number").notNull(),
    type: text("type").notNull().default("single"),
    capacity: integer("capacity").notNull().default(1),
    monthlyRent: integer("monthly_rent").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Room numbers identify a room to the owner and to tenants; two "101"s in
    // one property make bills ambiguous. The application checked this, but a
    // concurrent create slipped through.
    uniqueIndex("room_property_number_uq").on(table.propertyId, table.number),
  ],
);

export const electricityReading = pgTable("electricity_reading", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  reading: integer("reading").notNull(),
  units: integer("units").notNull().default(0),
  readingDate: timestamp("reading_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bed = pgTable(
  "bed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    /** Label within the room: A, B, C ... shown to the owner as "101-A". */
    number: text("number").notNull(),
    /** vacant | occupied | maintenance */
    status: text("status").notNull().default("vacant"),
    /** Optional per-bed rent, overriding the room's. */
    monthlyRent: integer("monthly_rent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("bed_room_number_uq").on(table.roomId, table.number)],
);

export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      // restrict, not cascade: deleting a property must not silently erase its
      // tenants and, through them, every bill and payment ever recorded.
      .references(() => property.id, { onDelete: "restrict" }),
    roomId: uuid("room_id").references(() => room.id, { onDelete: "set null" }),
    /**
     * The bed this tenant holds. Assignment target as of the bed model;
     * `roomId` is kept and derived from it so existing room-scoped queries and
     * the public signup flow keep working. Cleared when the tenant vacates.
     */
    bedId: uuid("bed_id").references(() => bed.id, { onDelete: "restrict" }),
    /**
     * The room a self-registered tenant asked for at signup, before an owner
     * has approved them and a real bed has been assigned. Kept separate from
     * `roomId` (the room they actually occupy) so a pending signup never
     * looks occupied or affects occupancy counts before approval.
     */
    requestedRoomId: uuid("requested_room_id").references(() => room.id, {
      onDelete: "set null",
    }),
    /** Set once approved; lets the tenant reach a private onboarding page. */
    onboardingToken: text("onboarding_token").unique(),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    /**
     * One tenant per bed, enforced by the database rather than by a
     * read-then-write check that two concurrent assignments both pass.
     * Partial, so any number of tenants may hold no bed at all.
     */
    uniqueIndex("tenant_bed_uq")
      .on(table.bedId)
      .where(sql`${table.bedId} is not null`),
  ],
);

export const bill = pgTable(
  "bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      // restrict: a bill is a financial record. Deleting a tenant must not
      // remove their billing history.
      .references(() => tenant.id, { onDelete: "restrict" }),
    billMonth: text("bill_month").notNull(),
    rentAmount: integer("rent_amount").notNull(),
    electricityAmount: integer("electricity_amount").notNull().default(0),
    /**
     * Itemised charges for this bill: [{ code, name, amount }, ...]. Rent and
     * electricity are also mirrored here as lines, so a bill's total is always
     * the sum of lineItems rather than a set of columns that can drift apart.
     * Historical bills keep their own lines even if the charge type, plan or
     * rate that produced them is later edited or deleted.
     */
    lineItems: jsonb("line_items").notNull().default([]),
    totalAmount: integer("total_amount").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0),
    balance: integer("balance").notNull(),
    status: text("status").notNull().default("pending"),
    /** Computed from the room's rent plan due_day at generation time. */
    dueDate: timestamp("due_date"),
    approved: boolean("approved").notNull().default(false),
    voidedAt: timestamp("voided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Billing idempotency. The generation loop checked for an existing bill
    // first, but two concurrent runs both passed the check and both inserted.
    // The legacy schema had this constraint; the rebuild dropped it.
    uniqueIndex("bill_tenant_month_uq").on(table.tenantId, table.billMonth),
    check(
      "bill_amounts_nonnegative",
      sql`${table.totalAmount} >= 0 and ${table.paidAmount} >= 0`,
    ),
  ],
);

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    // restrict: payments are the source of truth for what a tenant has paid.
    .references(() => bill.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  method: text("method"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const advancePayment = pgTable(
  "advance_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      // restrict: an advance is money already held. Deleting the tenant must
      // not silently erase the record of what the owner is holding for them.
      .references(() => tenant.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    date: timestamp("date").notNull().defaultNow(),
    /**
     * available: unapplied, still owed back or usable against a future bill.
     * applied: fully consumed against one or more bills; appliedAmount = amount.
     * forfeited: terminal — the owner keeps it, no further application.
     */
    status: text("status").notNull().default("available"),
    /** How much of `amount` has been applied so far; the rest stays available. */
    appliedAmount: integer("applied_amount").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("advance_payment_amount_positive", sql`${table.amount} > 0`),
    check(
      "advance_payment_applied_within_amount",
      sql`${table.appliedAmount} >= 0 and ${table.appliedAmount} <= ${table.amount}`,
    ),
  ],
);

export const securityDeposit = pgTable(
  "security_deposit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      // restrict: a held deposit is money the owner still owes back or is
      // entitled to keep against damages. Deleting the tenant must not erase
      // the record of what is owed.
      .references(() => tenant.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    /** held: nothing refunded yet. partial: some refunded. refunded: fully settled. */
    status: text("status").notNull().default("held"),
    refundAmount: integer("refund_amount").notNull().default(0),
    refundDate: timestamp("refund_date"),
    /** Owner's committed date for returning the balance; informational only. */
    promisedDate: timestamp("promised_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("security_deposit_amount_positive", sql`${table.amount} > 0`),
    check(
      "security_deposit_refund_within_amount",
      sql`${table.refundAmount} >= 0 and ${table.refundAmount} <= ${table.amount}`,
    ),
  ],
);

export const expenseCategory = pgTable(
  "expense_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("expense_category_property_name_uq").on(table.propertyId, table.name)],
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    // restrict: a category in use on real spend records cannot be deleted
    // out from under them.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    date: timestamp("date").notNull().defaultNow(),
    /** pending: awaiting the owner's decision. approved/rejected: terminal. */
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [check("expense_amount_positive", sql`${table.amount} > 0`)],
);

export const complaint = pgTable("complaint", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  roomNumber: text("room_number"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
