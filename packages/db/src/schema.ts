import {
  pgTable,
  text,
  timestamp as pgTimestamp,
  date,
  boolean,
  integer,
  bigint,
  uuid,
  uniqueIndex,
  index,
  check,
  jsonb,
  foreignKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Every timestamp is an absolute instant. Calendar-only business values use
// PostgreSQL `date` explicitly below, so neither kind depends on the Node or
// database session timezone.
const timestamp = <TName extends string>(name: TName) =>
  pgTimestamp(name, { withTimezone: true });

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

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// PGKhata domain tables

/**
 * Lifecycle of an owner account, in the order it can move:
 *   active -> suspended -> active            (an ops pause, fully reversible)
 *   active -> pending_deletion -> deleted    (offboarding, staged)
 *
 * `deleted` is a *logical* state. Nothing below the owner carries a deletedAt
 * of its own, because no property, tenant, bill or payment is reachable except
 * through the owner — one gate at the boundary is the whole enforcement
 * surface. Rows are removed physically only at purge time, a later phase.
 */
export const OWNER_STATUSES = [
  "active",
  "suspended",
  "pending_deletion",
  "deleted",
] as const;
export type OwnerStatus = (typeof OWNER_STATUSES)[number];

export const ownerProfile = pgTable(
  "owner_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    phone: text("phone"),
    // Defaults to 'active' so the column is additive: rows written by the
    // currently running code, which does not know this column exists, land in
    // exactly the state they are already in.
    status: text("status").notNull().default("active"),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    // set null, not cascade: removing the admin who paused an account must not
    // silently un-pause it, and admin_audit_log still names the human.
    suspendedBy: text("suspended_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "owner_profile_status_check",
      sql`${table.status} in ('active', 'suspended', 'pending_deletion', 'deleted')`,
    ),
    // A suspension with no timestamp is a suspension nobody can explain or
    // date, which is exactly the state support is asked to account for later.
    check(
      "owner_profile_suspended_requires_timestamp",
      sql`${table.status} <> 'suspended' or ${table.suspendedAt} is not null`,
    ),
    index("idx_owner_profile_status").on(table.status),
  ],
);

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => ownerProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code"),
  address: text("address"),
  landmark: text("landmark"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  description: text("description"),
  electricityMode: text("electricity_mode").notNull().default("flat"),
  electricityRatePerUnit: integer("electricity_rate_per_unit"),
  upiVpa: text("upi_vpa"),
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
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // "Ground floor" twice in one property makes the room grouping ambiguous.
    uniqueIndex("floor_property_name_uq").on(table.propertyId, table.name),
    uniqueIndex("floor_id_property_uq").on(table.id, table.propertyId),
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
    uniqueIndex("rent_plan_id_property_uq").on(table.id, table.propertyId),
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
    uniqueIndex("room_id_property_uq").on(table.id, table.propertyId),
    foreignKey({
      name: "room_floor_property_fk",
      columns: [table.floorId, table.propertyId],
      foreignColumns: [floor.id, floor.propertyId],
    }),
    foreignKey({
      name: "room_rent_plan_property_fk",
      columns: [table.rentPlanId, table.propertyId],
      foreignColumns: [rentPlan.id, rentPlan.propertyId],
    }),
  ],
);

export const electricityReading = pgTable(
  "electricity_reading",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    reading: integer("reading").notNull(),
    units: integer("units").notNull().default(0),
    readingDate: date("reading_date", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // One canonical reading per room/day also serves room/date lookups.
    uniqueIndex("electricity_reading_room_date_uq").on(table.roomId, table.readingDate),
  ],
);

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
  (table) => [
    uniqueIndex("bed_room_number_uq").on(table.roomId, table.number),
    uniqueIndex("bed_id_room_uq").on(table.id, table.roomId),
  ],
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
    alternatePhone: text("alternate_phone"),
    gender: text("gender"),
    occupation: text("occupation"),
    dateOfBirth: date("date_of_birth", { mode: "date" }),
    status: text("status").notNull().default("active"),
    joiningDate: date("joining_date", { mode: "date" }).notNull(),
    vacatingDate: date("vacating_date", { mode: "date" }),
    monthlyRentOverride: integer("monthly_rent_override"),
    deposit: integer("deposit"),
    notes: text("notes"),
    // Police verification fields
    aadhaarNumber: text("aadhaar_number"),
    panNumber: text("pan_number"),
    permanentAddress: text("permanent_address"),
    permanentAddressCity: text("permanent_address_city"),
    permanentAddressState: text("permanent_address_state"),
    permanentAddressPincode: text("permanent_address_pincode"),
    policeVerificationStatus: text("police_verification_status").default("pending"),
    policeVerificationDate: date("police_verification_date", { mode: "date" }),
    policeVerificationNotes: text("police_verification_notes"),
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
    uniqueIndex("tenant_id_property_uq").on(table.id, table.propertyId),
    foreignKey({
      name: "tenant_room_property_fk",
      columns: [table.roomId, table.propertyId],
      foreignColumns: [room.id, room.propertyId],
    }),
    foreignKey({
      name: "tenant_requested_room_property_fk",
      columns: [table.requestedRoomId, table.propertyId],
      foreignColumns: [room.id, room.propertyId],
    }),
    foreignKey({
      name: "tenant_bed_room_fk",
      columns: [table.bedId, table.roomId],
      foreignColumns: [bed.id, bed.roomId],
    }),
    check("tenant_bed_requires_room", sql`${table.bedId} is null or ${table.roomId} is not null`),
    check("tenant_bed_requires_active", sql`${table.bedId} is null or ${table.status} = 'active'`),
    // Index for property-scoped queries (tenants list, billing, dashboard)
    index("idx_tenant_property_status").on(table.propertyId, table.status),
  ],
);

/** Room/bed occupancy periods used for bed-day billing. */
export const occupancyHistory = pgTable(
  "occupancy_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").notNull().references(() => room.id, { onDelete: "cascade" }),
    bedId: uuid("bed_id").notNull().references(() => bed.id, { onDelete: "cascade" }),
    startedOn: date("started_on", { mode: "date" }).notNull(),
    endedOn: date("ended_on", { mode: "date" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("occupancy_history_one_open_per_tenant_uq")
      .on(table.tenantId)
      .where(sql`${table.endedOn} is null`),
    uniqueIndex("occupancy_history_one_open_per_bed_uq")
      .on(table.bedId)
      .where(sql`${table.endedOn} is null`),
    foreignKey({
      name: "occupancy_history_tenant_property_fk",
      columns: [table.tenantId, table.propertyId],
      foreignColumns: [tenant.id, tenant.propertyId],
    }),
    foreignKey({
      name: "occupancy_history_room_property_fk",
      columns: [table.roomId, table.propertyId],
      foreignColumns: [room.id, room.propertyId],
    }),
    foreignKey({
      name: "occupancy_history_bed_room_fk",
      columns: [table.bedId, table.roomId],
      foreignColumns: [bed.id, bed.roomId],
    }),
    check(
      "occupancy_history_period_valid",
      sql`${table.endedOn} is null or ${table.endedOn} >= ${table.startedOn}`,
    ),
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
    /** Calendar due date in the property's Asia/Kolkata business calendar. */
    dueDate: date("due_date", { mode: "date" }),
    approved: boolean("approved").notNull().default(false),
    voidedAt: timestamp("voided_at"),
    /** Tenant's promised payment date; late fees are suspended until this date. */
    promisedDate: date("promised_date", { mode: "date" }),
    revision: integer("revision").notNull().default(1),
    supersedesBillId: uuid("supersedes_bill_id").references(
      (): AnyPgColumn => bill.id,
      { onDelete: "restrict" },
    ),
    /** Opaque, stable public capability URL token. Never expose an owner session. */
    accessToken: text("access_token").notNull().default(sql`gen_random_uuid()::text`).unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Billing idempotency. The generation loop checked for an existing bill
    // first, but two concurrent runs both passed the check and both inserted.
    // The legacy schema had this constraint; the rebuild dropped it.
    uniqueIndex("bill_tenant_month_revision_uq").on(
      table.tenantId,
      table.billMonth,
      table.revision,
    ),
    uniqueIndex("bill_id_tenant_uq").on(table.id, table.tenantId),
    check(
      "bill_amounts_nonnegative",
      sql`${table.totalAmount} >= 0 and ${table.paidAmount} >= 0`,
    ),
    check(
      "bill_balance_consistent",
      sql`${table.voidedAt} is not null or (${table.paidAmount} <= ${table.totalAmount} and ${table.balance} = ${table.totalAmount} - ${table.paidAmount})`,
    ),
  ],
);

/** Auditable recalculation applied after an invoice was first generated. */
export const billAdjustment = pgTable("bill_adjustment", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bill.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // debit | credit
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  previousTotal: integer("previous_total").notNull(),
  adjustedTotal: integer("adjusted_total").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("bill_adjustment_amount_positive", sql`${table.amount} > 0`),
]);

/** Every direct bill delivery is retained so owners can see partial failures. */
export const billDelivery = pgTable("bill_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bill.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // email | whatsapp
  kind: text("kind").notNull().default("bill"), // bill | reminder
  status: text("status").notNull(), // sent | failed | skipped
  error: text("error"),
  providerMessageId: text("provider_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      // restrict: payments are the source of truth for what a tenant has paid.
      .references(() => bill.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    paymentDate: date("payment_date", { mode: "date" }).notNull(),
    method: text("method"),
    notes: text("notes"),
    /**
     * Idempotency key to prevent duplicate payments.
     * Generated client-side and sent with each payment request.
     * If a payment with this key already exists for this bill, the request is rejected.
     */
    idempotencyKey: text("idempotency_key").notNull().default(sql`gen_random_uuid()::text`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Prevent duplicate payments with the same idempotency key for a bill
    uniqueIndex("payment_idempotency_uq").on(table.idempotencyKey),
    // Index for bill-scoped queries (syncBillTotals, payment list)
    index("idx_payment_bill_id").on(table.billId),
    check("payment_amount_positive", sql`${table.amount} > 0`),
  ],
);

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
    date: date("date", { mode: "date" }).notNull().defaultNow(),
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
    uniqueIndex("advance_payment_id_tenant_uq").on(table.id, table.tenantId),
    check("advance_payment_amount_positive", sql`${table.amount} > 0`),
    check(
      "advance_payment_applied_within_amount",
      sql`${table.appliedAmount} >= 0 and ${table.appliedAmount} <= ${table.amount}`,
    ),
  ],
);

/** Auditable link proving an advance and its target bill belong to one tenant. */
export const advanceApplication = pgTable(
  "advance_application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advanceId: uuid("advance_id").notNull().references(() => advancePayment.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").notNull().references(() => bill.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").notNull().references(() => payment.id, { onDelete: "cascade" }).unique(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "advance_application_advance_tenant_fk",
      columns: [table.advanceId, table.tenantId],
      foreignColumns: [advancePayment.id, advancePayment.tenantId],
    }).onDelete("cascade"),
    foreignKey({
      name: "advance_application_bill_tenant_fk",
      columns: [table.billId, table.tenantId],
      foreignColumns: [bill.id, bill.tenantId],
    }).onDelete("cascade"),
    check("advance_application_amount_positive", sql`${table.amount} > 0`),
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
    refundDate: date("refund_date", { mode: "date" }),
    /** Owner's committed date for returning the balance; informational only. */
    promisedDate: date("promised_date", { mode: "date" }),
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
    foreignKey({
      name: "security_deposit_tenant_property_fk",
      columns: [table.tenantId, table.propertyId],
      foreignColumns: [tenant.id, tenant.propertyId],
    }),
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
  (table) => [
    uniqueIndex("expense_category_property_name_uq").on(table.propertyId, table.name),
    uniqueIndex("expense_category_id_property_uq").on(table.id, table.propertyId),
  ],
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
    date: date("date", { mode: "date" }).notNull().defaultNow(),
    /** pending: awaiting the owner's decision. approved/rejected: terminal. */
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("expense_amount_positive", sql`${table.amount} > 0`),
    foreignKey({
      name: "expense_category_property_fk",
      columns: [table.categoryId, table.propertyId],
      foreignColumns: [expenseCategory.id, expenseCategory.propertyId],
    }),
  ],
);

export const emergencyContact = pgTable("emergency_contact", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bedBooking = pgTable("bed_booking", {
  id: uuid("id").primaryKey().defaultRandom(),
  bedId: uuid("bed_id")
    .notNull()
    .references(() => bed.id, { onDelete: "cascade" }),
  tenantName: text("tenant_name").notNull(),
  tenantPhone: text("tenant_phone").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, converted
  bookingDate: timestamp("booking_date").notNull().defaultNow(),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    role: text("role").notNull().default("warden"), // warden, manager, accountant, cleaner
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("staff_id_property_uq").on(table.id, table.propertyId)],
);

export const propertyAmenity = pgTable(
  "property_amenity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("property_amenity_property_name_uq").on(
      table.propertyId,
      sql`lower(btrim(${table.name}))`,
    ),
  ],
);

export const billingPolicy = pgTable("billing_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  advanceHandlingMode: text("advance_handling_mode").notNull().default("manual"), // manual, auto_adjust
  bookingExpiryDays: integer("booking_expiry_days").notNull().default(3),
  autoAllocatePayments: boolean("auto_allocate_payments").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("billing_policy_property_uq").on(table.propertyId)]);

export const notificationPreference = pgTable("notification_preference", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // rent_due, rent_overdue, payment_received, tenant_checkin, etc.
  inApp: boolean("in_app").notNull().default(true),
  email: boolean("email").notNull().default(true),
  whatsapp: boolean("whatsapp").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("notification_preference_property_event_uq").on(
    table.propertyId,
    table.eventType,
  ),
]);

export const notification = pgTable("notification", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // payment_received, tenant_checkin, tenant_checkout, rent_due, booking_created, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  link: text("link"), // optional link to related entity
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantDocument = pgTable("tenant_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // aadhaar, pan, passport, driving_license, other
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  storageKey: text("storage_key").unique(),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminDocument = pgTable("admin_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // agreement, license, insurance, other
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  storageKey: text("storage_key").unique(),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const modulePermission = pgTable("module_permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // tenants, billing, expenses, reports, structure
  canView: boolean("can_view").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("module_permission_property_staff_module_uq").on(
    table.propertyId,
    table.staffId,
    table.module,
  ),
  foreignKey({
    name: "module_permission_staff_property_fk",
    columns: [table.staffId, table.propertyId],
    foreignColumns: [staff.id, staff.propertyId],
  }),
]);

export const complaint = pgTable("complaint", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .references(() => tenant.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  roomNumber: text("room_number"),
  category: text("category").default("other"),
  priority: text("priority").default("medium"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "complaint_tenant_property_fk",
    columns: [table.tenantId, table.propertyId],
    foreignColumns: [tenant.id, tenant.propertyId],
  }),
]);

export const PLATFORM_ADMIN_ROLES = ["super_admin", "support"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const platformAdmin = pgTable(
  "platform_admin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    // 'support' is the least-privileged default so a mis-typed insert cannot
    // hand out destructive access. Rows predating roles are backfilled to
    // 'super_admin' by the migration - they were unconstrained before.
    role: text("role").notNull().default("support"),
    // Revocation without deletion: a departed teammate's audit rows keep their
    // foreign key, and re-granting is a one-column flip.
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by").references((): AnyPgColumn => platformAdmin.id, {
      onDelete: "set null",
    }),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "platform_admin_role_check",
      sql`${table.role} in ('super_admin', 'support')`,
    ),
  ],
);

export const IMPERSONATION_MODES = ["read_only", "read_write"] as const;
export type ImpersonationMode = (typeof IMPERSONATION_MODES)[number];

/**
 * One support session: a platform admin acting inside one owner's account.
 *
 * The grant is the credential. Both token columns hold sha256 hex of a 32-byte
 * random value, so a database dump is not a bag of live sessions, and revoking
 * a session is an UPDATE that takes effect on the very next request rather than
 * a key rotation.
 */
export const impersonationSession = pgTable(
  "impersonation_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmin.id, { onDelete: "cascade" }),
    // Denormalised so the trail still names a human after the admin row goes.
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetOwnerId: uuid("target_owner_id")
      .notNull()
      .references(() => ownerProfile.id, { onDelete: "cascade" }),

    // Why this session was opened. Required: an unexplained support session is
    // the thing the audit trail exists to prevent.
    reason: text("reason").notNull(),
    mode: text("mode").notNull().default("read_only"),
    writeReason: text("write_reason"),
    writeGrantedAt: timestamp("write_granted_at"),
    // Write access lapses by timestamp comparison on every request, so a
    // crashed scheduler can never leave a session writable.
    writeExpiresAt: timestamp("write_expires_at"),

    // Single-use, 60s, exchanged once on the owner origin for the real cookie.
    handoffTokenHash: text("handoff_token_hash").unique(),
    handoffExpiresAt: timestamp("handoff_expires_at"),
    handoffClaimedAt: timestamp("handoff_claimed_at"),
    sessionTokenHash: text("session_token_hash").unique(),

    startedAt: timestamp("started_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    // Hard ceiling on renewals, so "extend" cannot become "forever".
    absoluteExpiresAt: timestamp("absolute_expires_at").notNull(),
    endedAt: timestamp("ended_at"),
    // admin_exit | expired | superseded | revoked | admin_deactivated
    endedReason: text("ended_reason"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    check(
      "impersonation_session_mode_check",
      sql`${table.mode} in ('read_only', 'read_write')`,
    ),
    check(
      "impersonation_session_write_window_check",
      sql`${table.mode} = 'read_only' or (${table.writeReason} is not null and ${table.writeExpiresAt} is not null)`,
    ),
    index("idx_impersonation_session_admin").on(table.adminId, table.startedAt),
    index("idx_impersonation_session_owner").on(table.targetOwnerId, table.startedAt),
  ],
);

/**
 * Append-only record of every privileged write. Because an escalated
 * impersonated write is attributed to the owner inside domain tables, this is
 * the only place the real human actor exists — see the append-only trigger in
 * the accompanying migration.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // set null, not cascade: revoking an admin must not erase what they did.
    adminId: uuid("admin_id").references(() => platformAdmin.id, { onDelete: "set null" }),
    adminUserId: text("admin_user_id").notNull(),
    adminEmail: text("admin_email").notNull(),
    impersonationSessionId: uuid("impersonation_session_id").references(
      () => impersonationSession.id,
      { onDelete: "set null" },
    ),

    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    // Intentionally NOT a foreign key: the most important row to keep is the
    // one recording that this owner was deleted.
    ownerId: uuid("owner_id"),

    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_admin_audit_log_created").on(table.createdAt),
    index("idx_admin_audit_log_owner").on(table.ownerId, table.createdAt),
    index("idx_admin_audit_log_admin").on(table.adminUserId, table.createdAt),
    index("idx_admin_audit_log_session").on(table.impersonationSessionId),
  ],
);

export const blogPost = pgTable("blog_post", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  author: text("author").notNull().default("Mukund Jha"),
  tags: jsonb("tags").notNull().default([]),
  coverImage: text("cover_image"),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
