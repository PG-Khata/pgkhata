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
import { randomUUID as randomUUID2 } from "crypto";

// ../../packages/auth/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// ../../packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  account: () => account,
  adminDocument: () => adminDocument,
  advancePayment: () => advancePayment,
  bed: () => bed,
  bedBooking: () => bedBooking,
  bill: () => bill,
  billingPolicy: () => billingPolicy,
  chargeType: () => chargeType,
  complaint: () => complaint,
  electricityReading: () => electricityReading,
  emergencyContact: () => emergencyContact,
  expense: () => expense,
  expenseCategory: () => expenseCategory,
  floor: () => floor,
  modulePermission: () => modulePermission,
  notification: () => notification,
  notificationPreference: () => notificationPreference,
  ownerProfile: () => ownerProfile,
  payment: () => payment,
  platformAdmin: () => platformAdmin,
  property: () => property,
  propertyAmenity: () => propertyAmenity,
  rentPlan: () => rentPlan,
  room: () => room,
  securityDeposit: () => securityDeposit,
  session: () => session,
  staff: () => staff,
  tenant: () => tenant,
  tenantDocument: () => tenantDocument,
  user: () => user,
  verification: () => verification
});
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  uniqueIndex,
  index,
  check,
  jsonb
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var floor = pgTable(
  "floor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Display order within the property; lower comes first. */
    position: integer("position").notNull().default(0),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    // "Ground floor" twice in one property makes the room grouping ambiguous.
    uniqueIndex("floor_property_name_uq").on(table.propertyId, table.name)
  ]
);
var rentPlan = pgTable(
  "rent_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("rent_plan_property_name_uq").on(table.propertyId, table.name),
    check("rent_plan_due_day_range", sql`${table.dueDay} between 1 and 28`),
    check("rent_plan_rent_nonnegative", sql`${table.monthlyRent} >= 0`),
    check(
      "rent_plan_late_fee_nonnegative",
      sql`${table.lateFeePerDay} is null or ${table.lateFeePerDay} >= 0`
    )
  ]
);
var chargeType = pgTable(
  "charge_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Short code a bill line item references: ELEC, WATER, MAINT. */
    code: text("code").notNull(),
    defaultAmount: integer("default_amount").notNull().default(0),
    /** Recurring charges (electricity) reappear each billing run; one-off ones don't. */
    isRecurring: boolean("is_recurring").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("charge_type_property_code_uq").on(table.propertyId, table.code),
    check("charge_type_amount_nonnegative", sql`${table.defaultAmount} >= 0`)
  ]
);
var room = pgTable(
  "room",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    // Nullable: rooms created before floors existed, and properties that never
    // model floors, group under "Unassigned". restrict, so removing a floor
    // cannot silently orphan its rooms.
    floorId: uuid("floor_id").references(() => floor.id, { onDelete: "restrict" }),
    /**
     * Nullable and restrict: a plan in use cannot be deleted out from under a
     * room, but a room need not have one — monthlyRent below is the fallback.
     */
    rentPlanId: uuid("rent_plan_id").references(() => rentPlan.id, {
      onDelete: "restrict"
    }),
    number: text("number").notNull(),
    type: text("type").notNull().default("single"),
    capacity: integer("capacity").notNull().default(1),
    monthlyRent: integer("monthly_rent").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    // Room numbers identify a room to the owner and to tenants; two "101"s in
    // one property make bills ambiguous. The application checked this, but a
    // concurrent create slipped through.
    uniqueIndex("room_property_number_uq").on(table.propertyId, table.number)
  ]
);
var electricityReading = pgTable(
  "electricity_reading",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull().references(() => room.id, { onDelete: "cascade" }),
    reading: integer("reading").notNull(),
    units: integer("units").notNull().default(0),
    readingDate: timestamp("reading_date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    // Index for room-scoped queries (reading list, billing generation)
    index("idx_electricity_reading_room_date").on(table.roomId, table.readingDate)
  ]
);
var bed = pgTable(
  "bed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull().references(() => room.id, { onDelete: "cascade" }),
    /** Label within the room: A, B, C ... shown to the owner as "101-A". */
    number: text("number").notNull(),
    /** vacant | occupied | maintenance */
    status: text("status").notNull().default("vacant"),
    /** Optional per-bed rent, overriding the room's. */
    monthlyRent: integer("monthly_rent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [uniqueIndex("bed_room_number_uq").on(table.roomId, table.number)]
);
var tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "restrict" }),
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
      onDelete: "set null"
    }),
    /** Set once approved; lets the tenant reach a private onboarding page. */
    onboardingToken: text("onboarding_token").unique(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull().unique(),
    alternatePhone: text("alternate_phone"),
    gender: text("gender"),
    occupation: text("occupation"),
    dateOfBirth: timestamp("date_of_birth"),
    status: text("status").notNull().default("active"),
    joiningDate: timestamp("joining_date").notNull(),
    vacatingDate: timestamp("vacating_date"),
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
    policeVerificationDate: timestamp("police_verification_date"),
    policeVerificationNotes: text("police_verification_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    /**
     * One tenant per bed, enforced by the database rather than by a
     * read-then-write check that two concurrent assignments both pass.
     * Partial, so any number of tenants may hold no bed at all.
     */
    uniqueIndex("tenant_bed_uq").on(table.bedId).where(sql`${table.bedId} is not null`),
    // Index for property-scoped queries (tenants list, billing, dashboard)
    index("idx_tenant_property_status").on(table.propertyId, table.status)
  ]
);
var bill = pgTable(
  "bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
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
    /** Tenant's promised payment date; late fees are suspended until this date. */
    promisedDate: timestamp("promised_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    // Billing idempotency. The generation loop checked for an existing bill
    // first, but two concurrent runs both passed the check and both inserted.
    // The legacy schema had this constraint; the rebuild dropped it.
    uniqueIndex("bill_tenant_month_uq").on(table.tenantId, table.billMonth),
    check(
      "bill_amounts_nonnegative",
      sql`${table.totalAmount} >= 0 and ${table.paidAmount} >= 0`
    )
  ]
);
var payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id").notNull().references(() => bill.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    paymentDate: timestamp("payment_date").notNull(),
    method: text("method"),
    notes: text("notes"),
    /**
     * Idempotency key to prevent duplicate payments.
     * Generated client-side and sent with each payment request.
     * If a payment with this key already exists for this bill, the request is rejected.
     */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    // Prevent duplicate payments with the same idempotency key for a bill
    uniqueIndex("payment_bill_idempotency_uq").on(table.billId, table.idempotencyKey).where(sql`${table.idempotencyKey} is not null`),
    // Index for bill-scoped queries (syncBillTotals, payment list)
    index("idx_payment_bill_id").on(table.billId)
  ]
);
var advancePayment = pgTable(
  "advance_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    check("advance_payment_amount_positive", sql`${table.amount} > 0`),
    check(
      "advance_payment_applied_within_amount",
      sql`${table.appliedAmount} >= 0 and ${table.appliedAmount} <= ${table.amount}`
    )
  ]
);
var securityDeposit = pgTable(
  "security_deposit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    /** held: nothing refunded yet. partial: some refunded. refunded: fully settled. */
    status: text("status").notNull().default("held"),
    refundAmount: integer("refund_amount").notNull().default(0),
    refundDate: timestamp("refund_date"),
    /** Owner's committed date for returning the balance; informational only. */
    promisedDate: timestamp("promised_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [
    check("security_deposit_amount_positive", sql`${table.amount} > 0`),
    check(
      "security_deposit_refund_within_amount",
      sql`${table.refundAmount} >= 0 and ${table.refundAmount} <= ${table.amount}`
    )
  ]
);
var expenseCategory = pgTable(
  "expense_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [uniqueIndex("expense_category_property_name_uq").on(table.propertyId, table.name)]
);
var expense = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    // restrict: a category in use on real spend records cannot be deleted
    // out from under them.
    categoryId: uuid("category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    date: timestamp("date").notNull().defaultNow(),
    /** pending: awaiting the owner's decision. approved/rejected: terminal. */
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
  },
  (table) => [check("expense_amount_positive", sql`${table.amount} > 0`)]
);
var emergencyContact = pgTable("emergency_contact", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var bedBooking = pgTable("bed_booking", {
  id: uuid("id").primaryKey().defaultRandom(),
  bedId: uuid("bed_id").notNull().references(() => bed.id, { onDelete: "cascade" }),
  tenantName: text("tenant_name").notNull(),
  tenantPhone: text("tenant_phone").notNull(),
  status: text("status").notNull().default("pending"),
  // pending, confirmed, cancelled, converted
  bookingDate: timestamp("booking_date").notNull().defaultNow(),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("warden"),
  // warden, manager, accountant, cleaner
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var propertyAmenity = pgTable("property_amenity", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var billingPolicy = pgTable("billing_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  advanceHandlingMode: text("advance_handling_mode").notNull().default("manual"),
  // manual, auto_adjust
  bookingExpiryDays: integer("booking_expiry_days").notNull().default(3),
  autoAllocatePayments: boolean("auto_allocate_payments").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var notificationPreference = pgTable("notification_preference", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  // rent_due, rent_overdue, payment_received, tenant_checkin, etc.
  inApp: boolean("in_app").notNull().default(true),
  email: boolean("email").notNull().default(true),
  whatsapp: boolean("whatsapp").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var notification = pgTable("notification", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // payment_received, tenant_checkin, tenant_checkout, rent_due, booking_created, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  link: text("link"),
  // optional link to related entity
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var tenantDocument = pgTable("tenant_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // aadhaar, pan, passport, driving_license, other
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var adminDocument = pgTable("admin_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  // agreement, license, insurance, other
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var modulePermission = pgTable("module_permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  // tenants, billing, expenses, reports, structure
  canView: boolean("can_view").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var complaint = pgTable("complaint", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenant.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  roomNumber: text("room_number"),
  category: text("category").default("other"),
  priority: text("priority").default("medium"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var platformAdmin = pgTable("platform_admin", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ../../packages/db/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
var db = drizzle(pool, { schema: schema_exports });

// ../../packages/email/src/client.ts
import { Resend } from "resend";
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
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL environment variable is required");
  }
  const { data, error } = await resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL,
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
  trustedOrigins: [
    process.env.CORS_ORIGIN || "http://localhost:3000",
    "https://pgkhata-web.onrender.com",
    "http://localhost:3000"
  ],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  cookies: {
    sessionToken: {
      name: "__Secure-better-auth.session_token",
      attributes: {
        sameSite: "none",
        secure: true,
        domain: ".onrender.com"
      }
    }
  }
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
import { eq as eq2, and, sql as sql2, inArray } from "drizzle-orm";

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

// src/lib/charge-types.ts
var ELECTRICITY_CODE = "ELEC";
async function seedElectricityChargeType(propertyId) {
  await db.insert(chargeType).values({
    propertyId,
    name: "Electricity",
    code: ELECTRICITY_CODE,
    defaultAmount: 0,
    isRecurring: true,
    isActive: true
  }).onConflictDoNothing({ target: [chargeType.propertyId, chargeType.code] });
}

// src/routes/properties.ts
var router = Router();
var createPropertySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  address: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  description: z.string().optional(),
  electricityMode: z.enum(["flat", "meter"]).default("flat"),
  electricityRatePerUnit: z.number().optional(),
  upiVpa: z.string().max(100).optional()
});
var updatePropertySchema = createPropertySchema.partial();
router.get("/", requireAuth, requireOwner, async (req, res) => {
  try {
    const properties = await db.select().from(property).where(eq2(property.ownerId, req.ownerId));
    if (properties.length === 0) {
      return res.json([]);
    }
    const propertyIds = properties.map((p) => p.id);
    const bedCounts = await db.select({
      propertyId: room.propertyId,
      totalBeds: sql2`count(${bed.id})::int`,
      occupiedBeds: sql2`count(case when ${bed.status} = 'occupied' then 1 end)::int`
    }).from(bed).innerJoin(room, eq2(bed.roomId, room.id)).where(inArray(room.propertyId, propertyIds)).groupBy(room.propertyId);
    const bedCountMap = new Map(
      bedCounts.map((bc) => [bc.propertyId, { totalBeds: bc.totalBeds, occupiedBeds: bc.occupiedBeds }])
    );
    const result = properties.map((p) => ({
      ...p,
      totalBeds: bedCountMap.get(p.id)?.totalBeds ?? 0,
      occupiedBeds: bedCountMap.get(p.id)?.occupiedBeds ?? 0
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
router.get("/:id/qr-code", requireAuth, requireOwner, async (req, res) => {
  try {
    const propertyId = param(req, "id");
    let [prop] = await db.select({ signupToken: property.signupToken }).from(property).where(
      and(
        eq2(property.id, propertyId),
        eq2(property.ownerId, req.ownerId)
      )
    ).limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (!prop.signupToken) {
      const { randomUUID: randomUUID3 } = await import("crypto");
      const newToken = randomUUID3();
      const [updated] = await db.update(property).set({ signupToken: newToken }).where(eq2(property.id, propertyId)).returning({ signupToken: property.signupToken });
      if (!updated) {
        return res.status(500).json({ error: "Failed to generate signup token" });
      }
      prop = { signupToken: updated.signupToken };
    }
    if (!process.env.APP_URL) {
      throw new Error("APP_URL environment variable is required");
    }
    const signupUrl = `${process.env.APP_URL}/public/signup/${prop.signupToken}`;
    res.json({
      url: signupUrl,
      token: prop.signupToken
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});
router.get("/:id/complaint-qr", requireAuth, requireOwner, async (req, res) => {
  try {
    const propertyId = param(req, "id");
    let [prop] = await db.select({ complaintToken: property.complaintToken }).from(property).where(
      and(
        eq2(property.id, propertyId),
        eq2(property.ownerId, req.ownerId)
      )
    ).limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (!prop.complaintToken) {
      const { randomUUID: randomUUID3 } = await import("crypto");
      const newToken = randomUUID3();
      const [updated] = await db.update(property).set({ complaintToken: newToken }).where(eq2(property.id, propertyId)).returning({ complaintToken: property.complaintToken });
      if (!updated) {
        return res.status(500).json({ error: "Failed to generate complaint token" });
      }
      prop = { complaintToken: updated.complaintToken };
    }
    if (!process.env.APP_URL) {
      throw new Error("APP_URL environment variable is required");
    }
    const complaintUrl = `${process.env.APP_URL}/public/complaint/${prop.complaintToken}`;
    res.json({
      url: complaintUrl,
      token: prop.complaintToken
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate complaint QR code" });
  }
});
router.get("/:id/complaints", requireAuth, requireOwner, async (req, res) => {
  try {
    const propertyId = param(req, "id");
    const [prop] = await db.select({ id: property.id }).from(property).where(
      and(
        eq2(property.id, propertyId),
        eq2(property.ownerId, req.ownerId)
      )
    ).limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    const complaints = await db.select({
      id: complaint.id,
      propertyId: complaint.propertyId,
      subject: complaint.subject,
      description: complaint.description,
      roomNumber: complaint.roomNumber,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email
    }).from(complaint).leftJoin(tenant, eq2(complaint.tenantId, tenant.id)).where(eq2(complaint.propertyId, propertyId)).orderBy(
      sql2`CASE
          WHEN ${complaint.status} = 'open' THEN 1
          WHEN ${complaint.status} = 'in_progress' THEN 2
          WHEN ${complaint.status} = 'resolved' THEN 3
          ELSE 4
        END`,
      complaint.createdAt
    );
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});
router.patch("/:id/complaints/:complaintId", requireAuth, requireOwner, async (req, res) => {
  try {
    const propertyId = param(req, "id");
    const complaintId = param(req, "complaintId");
    const { status } = req.body;
    const validStatuses = ["open", "in_progress", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }
    const [prop] = await db.select({ id: property.id }).from(property).where(
      and(
        eq2(property.id, propertyId),
        eq2(property.ownerId, req.ownerId)
      )
    ).limit(1);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    const [updated] = await db.update(complaint).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(
      and(
        eq2(complaint.id, complaintId),
        eq2(complaint.propertyId, propertyId)
      )
    ).returning();
    if (!updated) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update complaint" });
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
    if (newProperty) {
      await seedElectricityChargeType(newProperty.id);
    }
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

// src/routes/floors.ts
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
import { eq as eq4, and as and3, asc, sql as sql3, inArray as inArray2 } from "drizzle-orm";

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

// src/routes/floors.ts
var router2 = Router2({ mergeParams: true });
var createFloorSchema = z2.object({
  name: z2.string().min(1).max(50),
  position: z2.number().int().min(0).max(200).optional(),
  description: z2.string().optional()
});
var updateFloorSchema = createFloorSchema.partial();
var reorderSchema = z2.object({
  floorIds: z2.array(z2.string().uuid()).min(1)
});
router2.use(requireAuth, requireOwner, requireProperty);
router2.get("/", async (req, res) => {
  try {
    const floors = await db.select({
      floor,
      roomCount: sql3`count(${room.id})::int`
    }).from(floor).leftJoin(room, eq4(room.floorId, floor.id)).where(eq4(floor.propertyId, req.propertyId)).groupBy(floor.id).orderBy(asc(floor.position), asc(floor.name));
    res.json(floors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch floors" });
  }
});
router2.get("/:floorId", async (req, res) => {
  try {
    const [f] = await db.select().from(floor).where(
      and3(
        eq4(floor.id, param(req, "floorId")),
        eq4(floor.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!f) return res.status(404).json({ error: "Floor not found" });
    res.json(f);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch floor" });
  }
});
router2.post("/", async (req, res) => {
  try {
    const body = createFloorSchema.parse(req.body);
    let position = body.position;
    if (position === void 0) {
      const { maxPosition } = aggregate(
        await db.select({
          maxPosition: sql3`coalesce(max(${floor.position}), -1)::int`
        }).from(floor).where(eq4(floor.propertyId, req.propertyId)),
        { maxPosition: -1 }
      );
      position = maxPosition + 1;
    }
    const [created] = await db.insert(floor).values({ propertyId: req.propertyId, name: body.name, position }).onConflictDoNothing({ target: [floor.propertyId, floor.name] }).returning();
    if (!created) {
      return res.status(409).json({ error: "Floor name already exists" });
    }
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create floor" });
  }
});
router2.post("/reorder", async (req, res) => {
  try {
    const { floorIds } = reorderSchema.parse(req.body);
    if (new Set(floorIds).size !== floorIds.length) {
      return res.status(400).json({ error: "Duplicate floor ids" });
    }
    const owned = await db.select({ id: floor.id }).from(floor).where(
      and3(eq4(floor.propertyId, req.propertyId), inArray2(floor.id, floorIds))
    );
    if (owned.length !== floorIds.length) {
      return res.status(404).json({ error: "Floor not found" });
    }
    const reordered = await db.transaction(async (tx) => {
      for (const [index2, id] of floorIds.entries()) {
        await tx.update(floor).set({ position: index2, updatedAt: /* @__PURE__ */ new Date() }).where(and3(eq4(floor.id, id), eq4(floor.propertyId, req.propertyId)));
      }
      return tx.select().from(floor).where(eq4(floor.propertyId, req.propertyId)).orderBy(asc(floor.position), asc(floor.name));
    });
    res.json(reordered);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to reorder floors" });
  }
});
router2.put("/:floorId", async (req, res) => {
  try {
    const body = updateFloorSchema.parse(req.body);
    const [updated] = await db.update(floor).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(
      and3(
        eq4(floor.id, param(req, "floorId")),
        eq4(floor.propertyId, req.propertyId)
      )
    ).returning();
    if (!updated) return res.status(404).json({ error: "Floor not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update floor" });
  }
});
router2.delete("/:floorId", async (req, res) => {
  try {
    const floorId = param(req, "floorId");
    const [f] = await db.select({ id: floor.id }).from(floor).where(and3(eq4(floor.id, floorId), eq4(floor.propertyId, req.propertyId))).limit(1);
    if (!f) return res.status(404).json({ error: "Floor not found" });
    const { roomCount } = aggregate(
      await db.select({ roomCount: sql3`count(*)::int` }).from(room).where(eq4(room.floorId, floorId)),
      { roomCount: 0 }
    );
    if (roomCount > 0) {
      return res.status(409).json({
        error: `Floor still has ${roomCount} room${roomCount === 1 ? "" : "s"}. Move or delete them first.`
      });
    }
    await db.delete(floor).where(eq4(floor.id, floorId));
    res.json({ message: "Floor deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete floor" });
  }
});
var floors_default = router2;

// src/routes/rent-plans.ts
import { Router as Router3 } from "express";
import { z as z3 } from "zod";
import { eq as eq5, and as and4, asc as asc2 } from "drizzle-orm";
var router3 = Router3({ mergeParams: true });
var createPlanSchema = z3.object({
  name: z3.string().min(1).max(50),
  monthlyRent: z3.number().int().min(0),
  securityDeposit: z3.number().int().min(0).nullable().optional(),
  dueDay: z3.number().int().min(1).max(28).default(1),
  lateFeePerDay: z3.number().int().min(0).nullable().optional(),
  isActive: z3.boolean().default(true),
  minStayMonths: z3.number().int().min(0).nullable().optional(),
  noticePeriodDays: z3.number().int().min(0).nullable().optional(),
  description: z3.string().max(500).nullable().optional()
});
var updatePlanSchema = createPlanSchema.partial();
router3.use(requireAuth, requireOwner, requireProperty);
router3.get("/", async (req, res) => {
  try {
    const plans = await db.select({
      plan: rentPlan,
      roomCount: db.$count(room, eq5(room.rentPlanId, rentPlan.id))
    }).from(rentPlan).where(eq5(rentPlan.propertyId, req.propertyId)).orderBy(asc2(rentPlan.name));
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rent plans" });
  }
});
router3.get("/:planId", async (req, res) => {
  try {
    const [plan] = await db.select().from(rentPlan).where(
      and4(eq5(rentPlan.id, param(req, "planId")), eq5(rentPlan.propertyId, req.propertyId))
    ).limit(1);
    if (!plan) return res.status(404).json({ error: "Rent plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rent plan" });
  }
});
router3.post("/", async (req, res) => {
  try {
    const body = createPlanSchema.parse(req.body);
    const [created] = await db.insert(rentPlan).values({ ...body, propertyId: req.propertyId }).onConflictDoNothing({ target: [rentPlan.propertyId, rentPlan.name] }).returning();
    if (!created) {
      return res.status(409).json({ error: "A rent plan with this name already exists" });
    }
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create rent plan" });
  }
});
router3.put("/:planId", async (req, res) => {
  try {
    const body = updatePlanSchema.parse(req.body);
    const planId = param(req, "planId");
    const [updated] = await db.update(rentPlan).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq5(rentPlan.id, planId), eq5(rentPlan.propertyId, req.propertyId))).returning();
    if (!updated) return res.status(404).json({ error: "Rent plan not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update rent plan" });
  }
});
router3.delete("/:planId", async (req, res) => {
  try {
    const planId = param(req, "planId");
    const [plan] = await db.select({ id: rentPlan.id }).from(rentPlan).where(and4(eq5(rentPlan.id, planId), eq5(rentPlan.propertyId, req.propertyId))).limit(1);
    if (!plan) return res.status(404).json({ error: "Rent plan not found" });
    const { roomCount } = aggregate(
      await db.select({ roomCount: db.$count(room, eq5(room.rentPlanId, planId)) }).from(rentPlan).where(eq5(rentPlan.id, planId)),
      { roomCount: 0 }
    );
    if (roomCount > 0) {
      return res.status(409).json({
        error: `Plan still used by ${roomCount} room${roomCount === 1 ? "" : "s"}. Reassign them first.`
      });
    }
    await db.delete(rentPlan).where(eq5(rentPlan.id, planId));
    res.json({ message: "Rent plan deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rent plan" });
  }
});
var rent_plans_default = router3;

// src/routes/charge-types.ts
import { Router as Router4 } from "express";
import { z as z4 } from "zod";
import { eq as eq6, and as and5, asc as asc3 } from "drizzle-orm";
var router4 = Router4({ mergeParams: true });
var codePattern = /^[A-Za-z0-9_]+$/;
var createSchema = z4.object({
  name: z4.string().min(1).max(50),
  code: z4.string().min(1).max(20).regex(codePattern, "Use letters, numbers and underscores"),
  defaultAmount: z4.number().int().min(0).default(0),
  isRecurring: z4.boolean().default(true),
  isActive: z4.boolean().default(true)
});
var updateSchema = createSchema.partial().omit({ code: true });
router4.use(requireAuth, requireOwner, requireProperty);
router4.get("/", async (req, res) => {
  try {
    await seedElectricityChargeType(req.propertyId);
    const types = await db.select().from(chargeType).where(eq6(chargeType.propertyId, req.propertyId)).orderBy(asc3(chargeType.name));
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch charge types" });
  }
});
router4.get("/:chargeTypeId", async (req, res) => {
  try {
    const [type] = await db.select().from(chargeType).where(
      and5(
        eq6(chargeType.id, param(req, "chargeTypeId")),
        eq6(chargeType.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!type) return res.status(404).json({ error: "Charge type not found" });
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch charge type" });
  }
});
router4.post("/", async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const [created] = await db.insert(chargeType).values({ ...body, code, propertyId: req.propertyId }).onConflictDoNothing({ target: [chargeType.propertyId, chargeType.code] }).returning();
    if (!created) {
      return res.status(409).json({ error: `Charge type code ${code} already exists` });
    }
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create charge type" });
  }
});
router4.put("/:chargeTypeId", async (req, res) => {
  try {
    const body = updateSchema.parse(req.body);
    const chargeTypeId = param(req, "chargeTypeId");
    const [existing] = await db.select({ id: chargeType.id, code: chargeType.code }).from(chargeType).where(and5(eq6(chargeType.id, chargeTypeId), eq6(chargeType.propertyId, req.propertyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Charge type not found" });
    if (existing.code === ELECTRICITY_CODE && body.isActive === false) {
      return res.status(409).json({
        error: "The electricity charge type cannot be deactivated"
      });
    }
    const [updated] = await db.update(chargeType).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(chargeType.id, chargeTypeId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update charge type" });
  }
});
router4.delete("/:chargeTypeId", async (req, res) => {
  try {
    const chargeTypeId = param(req, "chargeTypeId");
    const [existing] = await db.select({ id: chargeType.id, code: chargeType.code }).from(chargeType).where(and5(eq6(chargeType.id, chargeTypeId), eq6(chargeType.propertyId, req.propertyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Charge type not found" });
    if (existing.code === ELECTRICITY_CODE) {
      return res.status(409).json({ error: "The electricity charge type cannot be deleted" });
    }
    await db.delete(chargeType).where(eq6(chargeType.id, chargeTypeId));
    res.json({ message: "Charge type deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete charge type" });
  }
});
var charge_types_default = router4;

// src/routes/rooms.ts
import { Router as Router5 } from "express";
import { z as z5 } from "zod";
import { eq as eq7, and as and6, asc as asc4, inArray as inArray3 } from "drizzle-orm";

// src/lib/beds.ts
var BED_STATUSES = ["vacant", "occupied", "maintenance"];
function bedLabel(index2) {
  if (!Number.isInteger(index2) || index2 < 0) {
    throw new Error(`Bed index must be a non-negative integer, got ${index2}`);
  }
  let label = "";
  let remaining = index2;
  do {
    label = String.fromCharCode(65 + remaining % 26) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}
function bedLabelsForCapacity(capacity) {
  return Array.from({ length: capacity }, (_, index2) => bedLabel(index2));
}
function reconcileBeds(existing, capacity) {
  const target = bedLabelsForCapacity(capacity);
  const targetSet = new Set(target);
  const present = new Set(existing.map((bed2) => bed2.number));
  const toCreate = target.filter((label) => !present.has(label));
  const surplus = existing.filter((bed2) => !targetSet.has(bed2.number));
  const blockedBy = surplus.filter((bed2) => bed2.status === "occupied").map((bed2) => bed2.number).sort();
  return {
    toCreate,
    toDelete: blockedBy.length > 0 ? [] : surplus.map((bed2) => bed2.number).sort(),
    blockedBy
  };
}

// src/routes/rooms.ts
var router5 = Router5({ mergeParams: true });
var createRoomSchema = z5.object({
  number: z5.string().min(1).max(20),
  type: z5.enum(["single", "double", "triple", "dormitory"]).default("single"),
  capacity: z5.number().min(1).max(20).default(1),
  monthlyRent: z5.number().min(0),
  floorId: z5.string().uuid().nullable().optional(),
  rentPlanId: z5.string().uuid().nullable().optional()
});
var updateRoomSchema = createRoomSchema.partial();
router5.use(requireAuth, requireOwner, requireProperty);
async function assertFloorInProperty(propertyId, floorId) {
  if (!floorId) return true;
  const [f] = await db.select({ id: floor.id }).from(floor).where(and6(eq7(floor.id, floorId), eq7(floor.propertyId, propertyId))).limit(1);
  return Boolean(f);
}
async function assertPlanInProperty(propertyId, planId) {
  if (!planId) return true;
  const [p] = await db.select({ id: rentPlan.id }).from(rentPlan).where(and6(eq7(rentPlan.id, planId), eq7(rentPlan.propertyId, propertyId))).limit(1);
  return Boolean(p);
}
router5.get("/", async (req, res) => {
  try {
    const rooms = await db.select({
      room,
      floorName: floor.name,
      floorPosition: floor.position,
      planName: rentPlan.name,
      planRent: rentPlan.monthlyRent
    }).from(room).leftJoin(floor, eq7(room.floorId, floor.id)).leftJoin(rentPlan, eq7(room.rentPlanId, rentPlan.id)).where(eq7(room.propertyId, req.propertyId)).orderBy(asc4(floor.position), asc4(room.number));
    const roomIds = rooms.map((row) => row.room.id);
    const beds = roomIds.length > 0 ? await db.select().from(bed).where(inArray3(bed.roomId, roomIds)).orderBy(asc4(bed.number)) : [];
    const bedsByRoom = /* @__PURE__ */ new Map();
    for (const b of beds) {
      const bucket = bedsByRoom.get(b.roomId);
      if (bucket) bucket.push(b);
      else bedsByRoom.set(b.roomId, [b]);
    }
    res.json(
      rooms.map((row) => ({
        ...row.room,
        floorName: row.floorName,
        floorPosition: row.floorPosition,
        planName: row.planName,
        planRent: row.planRent,
        beds: bedsByRoom.get(row.room.id) ?? []
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});
router5.get("/:roomId", async (req, res) => {
  try {
    const [r] = await db.select().from(room).where(
      and6(
        eq7(room.id, param(req, "roomId")),
        eq7(room.propertyId, req.propertyId)
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
router5.post("/", async (req, res) => {
  try {
    const body = createRoomSchema.parse(req.body);
    if (!await assertFloorInProperty(req.propertyId, body.floorId)) {
      return res.status(404).json({ error: "Floor not found" });
    }
    if (!await assertPlanInProperty(req.propertyId, body.rentPlanId)) {
      return res.status(404).json({ error: "Rent plan not found" });
    }
    const newRoom = await db.transaction(async (tx) => {
      const [created] = await tx.insert(room).values({
        ...body,
        propertyId: req.propertyId
      }).onConflictDoNothing({ target: [room.propertyId, room.number] }).returning();
      if (!created) return void 0;
      await tx.insert(bed).values(
        bedLabelsForCapacity(created.capacity).map((label) => ({
          roomId: created.id,
          number: label
        }))
      );
      return created;
    });
    if (!newRoom) {
      return res.status(409).json({ error: "Room number already exists" });
    }
    res.status(201).json(newRoom);
  } catch (error) {
    if (error instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create room" });
  }
});
router5.put("/:roomId", async (req, res) => {
  try {
    const body = updateRoomSchema.parse(req.body);
    const roomId = param(req, "roomId");
    if (!await assertFloorInProperty(req.propertyId, body.floorId)) {
      return res.status(404).json({ error: "Floor not found" });
    }
    if (!await assertPlanInProperty(req.propertyId, body.rentPlanId)) {
      return res.status(404).json({ error: "Rent plan not found" });
    }
    const [existingRoom] = await db.select().from(room).where(and6(eq7(room.id, roomId), eq7(room.propertyId, req.propertyId))).limit(1);
    if (!existingRoom) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (body.capacity !== void 0 && body.capacity !== existingRoom.capacity) {
      const existingBeds = await db.select({ number: bed.number, status: bed.status }).from(bed).where(eq7(bed.roomId, roomId));
      const plan = reconcileBeds(existingBeds, body.capacity);
      if (plan.blockedBy.length > 0) {
        return res.status(409).json({
          error: `Cannot reduce capacity: bed ${plan.blockedBy.join(", ")} ${plan.blockedBy.length === 1 ? "is" : "are"} occupied. Vacate first.`
        });
      }
      const updated2 = await db.transaction(async (tx) => {
        if (plan.toCreate.length > 0) {
          await tx.insert(bed).values(plan.toCreate.map((label) => ({ roomId, number: label })));
        }
        if (plan.toDelete.length > 0) {
          await tx.delete(bed).where(and6(eq7(bed.roomId, roomId), inArray3(bed.number, plan.toDelete)));
        }
        const [row] = await tx.update(room).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(and6(eq7(room.id, roomId), eq7(room.propertyId, req.propertyId))).returning();
        return row;
      });
      return res.json(updated2);
    }
    const [updated] = await db.update(room).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(and6(eq7(room.id, roomId), eq7(room.propertyId, req.propertyId))).returning();
    if (!updated) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update room" });
  }
});
router5.delete("/:roomId", async (req, res) => {
  try {
    const roomId = param(req, "roomId");
    const [target] = await db.select({ id: room.id }).from(room).where(and6(eq7(room.id, roomId), eq7(room.propertyId, req.propertyId))).limit(1);
    if (!target) {
      return res.status(404).json({ error: "Room not found" });
    }
    const occupied = await db.select({ number: bed.number }).from(bed).where(and6(eq7(bed.roomId, roomId), eq7(bed.status, "occupied"))).orderBy(asc4(bed.number));
    if (occupied.length > 0) {
      return res.status(409).json({
        error: `Room still has ${occupied.length} occupied bed${occupied.length === 1 ? "" : "s"} (${occupied.map((b) => b.number).join(", ")}). Vacate first.`
      });
    }
    await db.delete(room).where(eq7(room.id, roomId));
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});
var rooms_default = router5;

// src/routes/beds.ts
import { Router as Router6 } from "express";
import { z as z6 } from "zod";
import { eq as eq8, and as and7, asc as asc5 } from "drizzle-orm";
var router6 = Router6({ mergeParams: true });
var statusSchema = z6.object({
  status: z6.enum(BED_STATUSES)
});
var updateBedSchema = z6.object({
  monthlyRent: z6.number().int().min(0).nullable().optional()
});
router6.use(requireAuth, requireOwner, requireProperty);
function bedInProperty(propertyId, bedId) {
  return db.select({ bed, roomNumber: room.number }).from(bed).innerJoin(room, eq8(bed.roomId, room.id)).where(and7(eq8(bed.id, bedId), eq8(room.propertyId, propertyId))).limit(1);
}
router6.get("/", async (req, res) => {
  try {
    const beds = await db.select({
      bed,
      roomId: room.id,
      roomNumber: room.number,
      roomRent: room.monthlyRent,
      floorName: floor.name
    }).from(bed).innerJoin(room, eq8(bed.roomId, room.id)).leftJoin(floor, eq8(room.floorId, floor.id)).where(eq8(room.propertyId, req.propertyId)).orderBy(asc5(floor.position), asc5(room.number), asc5(bed.number));
    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch beds" });
  }
});
router6.get("/vacant", async (req, res) => {
  try {
    const beds = await db.select({
      bed,
      roomId: room.id,
      roomNumber: room.number,
      roomRent: room.monthlyRent,
      floorName: floor.name
    }).from(bed).innerJoin(room, eq8(bed.roomId, room.id)).leftJoin(floor, eq8(room.floorId, floor.id)).where(and7(eq8(room.propertyId, req.propertyId), eq8(bed.status, "vacant"))).orderBy(asc5(floor.position), asc5(room.number), asc5(bed.number));
    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vacant beds" });
  }
});
router6.get("/:bedId", async (req, res) => {
  try {
    const [found] = await bedInProperty(req.propertyId, param(req, "bedId"));
    if (!found) return res.status(404).json({ error: "Bed not found" });
    res.json({ ...found.bed, roomNumber: found.roomNumber });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bed" });
  }
});
router6.patch("/:bedId/status", async (req, res) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const bedId = param(req, "bedId");
    const [found] = await bedInProperty(req.propertyId, bedId);
    if (!found) return res.status(404).json({ error: "Bed not found" });
    if (found.bed.status === "occupied" && status === "maintenance") {
      return res.status(409).json({
        error: `Bed ${found.roomNumber}-${found.bed.number} is occupied. Vacate it before marking maintenance.`
      });
    }
    const [updated] = await db.update(bed).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(bed.id, bedId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update bed status" });
  }
});
router6.put("/:bedId", async (req, res) => {
  try {
    const body = updateBedSchema.parse(req.body);
    const bedId = param(req, "bedId");
    const [found] = await bedInProperty(req.propertyId, bedId);
    if (!found) return res.status(404).json({ error: "Bed not found" });
    const [updated] = await db.update(bed).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(bed.id, bedId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update bed" });
  }
});
var beds_default = router6;

// src/routes/room-beds.ts
import { Router as Router7 } from "express";
import { eq as eq9, and as and8, asc as asc6 } from "drizzle-orm";
var router7 = Router7({ mergeParams: true });
router7.use(requireAuth, requireOwner, requireProperty);
router7.get("/", async (req, res) => {
  try {
    const roomId = param(req, "roomId");
    const [target] = await db.select({ id: room.id }).from(room).where(and8(eq9(room.id, roomId), eq9(room.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Room not found" });
    const beds = await db.select().from(bed).where(eq9(bed.roomId, roomId)).orderBy(asc6(bed.number));
    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch beds" });
  }
});
var room_beds_default = router7;

// src/routes/tenants.ts
import { Router as Router8 } from "express";
import { z as z7 } from "zod";
import { eq as eq11, and as and10, asc as asc7 } from "drizzle-orm";

// src/lib/tenant-assignment.ts
import { eq as eq10, and as and9, inArray as inArray4 } from "drizzle-orm";

// src/lib/assignment.ts
function resolveBedForAssignment(beds, target) {
  if (target.bedId) {
    const bed2 = beds.find((candidate) => candidate.id === target.bedId);
    if (!bed2) return { ok: false, reason: "bed-not-found" };
    if (bed2.status === "occupied") {
      return { ok: false, reason: "bed-occupied", bedNumber: bed2.number };
    }
    if (bed2.status === "maintenance") {
      return { ok: false, reason: "bed-maintenance", bedNumber: bed2.number };
    }
    return { ok: true, bed: bed2 };
  }
  if (target.roomId) {
    const roomBeds = beds.filter((candidate) => candidate.roomId === target.roomId);
    if (roomBeds.length === 0) return { ok: false, reason: "bed-not-found" };
    const vacant = roomBeds.filter((candidate) => candidate.status === "vacant").sort((a, b) => a.number.localeCompare(b.number, void 0, { numeric: true }));
    const first = vacant[0];
    if (!first) return { ok: false, reason: "room-full", roomId: target.roomId };
    return { ok: true, bed: first };
  }
  return { ok: false, reason: "no-target" };
}
function assignmentErrorMessage(failure, roomNumber) {
  const at = (bedNumber) => roomNumber ? `${roomNumber}-${bedNumber}` : bedNumber;
  switch (failure.reason) {
    case "bed-not-found":
      return "Bed not found";
    case "bed-occupied":
      return `Bed ${at(failure.bedNumber)} is already occupied`;
    case "bed-maintenance":
      return `Bed ${at(failure.bedNumber)} is under maintenance`;
    case "room-full":
      return "Room has no vacant beds";
    case "no-target":
      return "Provide a bed or a room to assign";
  }
}
var OCCUPIED = "occupied";
var FREED = "vacant";

// src/lib/tenant-assignment.ts
async function assignableBeds(propertyId) {
  const rows = await db.select({
    id: bed.id,
    roomId: bed.roomId,
    number: bed.number,
    status: bed.status,
    roomNumber: room.number
  }).from(bed).innerJoin(room, eq10(bed.roomId, room.id)).where(eq10(room.propertyId, propertyId));
  return rows;
}
async function assignTenantToBed(propertyId, tenantId, target) {
  const beds = await assignableBeds(propertyId);
  const decision = resolveBedForAssignment(beds, target);
  if (!decision.ok) {
    const roomNumber2 = beds.find(
      (b) => "bedNumber" in decision ? b.number === decision.bedNumber : false
    )?.roomNumber;
    const status = decision.reason === "bed-not-found" ? 404 : 409;
    throw new HttpError(status, assignmentErrorMessage(decision, roomNumber2));
  }
  const chosen = decision.bed;
  const roomNumber = beds.find((b) => b.id === chosen.id)?.roomNumber ?? "";
  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx.select({ id: bed.id, status: bed.status }).from(bed).where(eq10(bed.id, chosen.id)).for("update");
      if (!locked) throw new HttpError(404, "Bed not found");
      if (locked.status !== "vacant") {
        throw new HttpError(
          409,
          `Bed ${roomNumber}-${chosen.number} is no longer available`
        );
      }
      const [current] = await tx.select({ id: tenant.id, bedId: tenant.bedId }).from(tenant).where(and9(eq10(tenant.id, tenantId), eq10(tenant.propertyId, propertyId))).limit(1);
      if (!current) throw new HttpError(404, "Tenant not found");
      if (current.bedId && current.bedId !== chosen.id) {
        await tx.update(bed).set({ status: FREED, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(bed.id, current.bedId));
      }
      await tx.update(tenant).set({ bedId: chosen.id, roomId: chosen.roomId, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(tenant.id, tenantId));
      await tx.update(bed).set({ status: OCCUPIED, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(bed.id, chosen.id));
      return {
        bedId: chosen.id,
        roomId: chosen.roomId,
        bedNumber: chosen.number,
        roomNumber
      };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error, "tenant_bed_uq")) {
      throw new HttpError(
        409,
        `Bed ${roomNumber}-${chosen.number} was just taken by someone else`
      );
    }
    throw error;
  }
}
async function vacateTenantBed(propertyId, tenantId) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: tenant.id, bedId: tenant.bedId }).from(tenant).where(and9(eq10(tenant.id, tenantId), eq10(tenant.propertyId, propertyId))).limit(1);
    if (!current) throw new HttpError(404, "Tenant not found");
    if (!current.bedId) return { freedBedId: null };
    await tx.update(tenant).set({ bedId: null, roomId: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(tenant.id, tenantId));
    await tx.update(bed).set({ status: FREED, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(bed.id, current.bedId));
    return { freedBedId: current.bedId };
  });
}
function isUniqueViolation(error, constraint) {
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current;
    if (candidate.code === "23505" && candidate.constraint === constraint) return true;
    current = candidate.cause;
  }
  return false;
}

// src/lib/tenant-approval.ts
import { randomBytes } from "crypto";
function decideTenantApproval(tenant2, decision) {
  if (tenant2.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true, newStatus: decision === "approve" ? "active" : "rejected" };
}
function generateOnboardingToken() {
  return randomBytes(24).toString("base64url");
}

// src/lib/checkout-preview.ts
function calculateCheckoutPreview(input) {
  const totalOutstanding = input.outstandingBills.reduce((sum, b) => sum + b.balance, 0);
  const depositHeld = input.securityDeposit?.status !== "refunded" ? (input.securityDeposit?.amount ?? 0) - (input.securityDeposit?.refundAmount ?? 0) : 0;
  const advanceBalance = input.advancePayments.filter((a) => a.status === "available").reduce((sum, a) => sum + (a.amount - a.appliedAmount), 0);
  const netSettlement = depositHeld + advanceBalance - totalOutstanding;
  return {
    totalOutstanding,
    depositHeld,
    depositToRefund: Math.max(0, netSettlement),
    advanceBalance,
    netSettlement
  };
}

// src/lib/bed-transfer.ts
function validateTransfer(currentBedId, newBedId, newBedStatus) {
  if (!currentBedId) {
    return { ok: false, reason: "Tenant has no bed to transfer from" };
  }
  if (currentBedId === newBedId) {
    return { ok: false, reason: "Tenant is already in this bed" };
  }
  if (newBedStatus !== "vacant") {
    return { ok: false, reason: "Target bed is not vacant" };
  }
  return { ok: true };
}

// src/routes/tenants.ts
var router8 = Router8({ mergeParams: true });
var createTenantSchema = z7.object({
  name: z7.string().min(1).max(100),
  email: z7.string().email().optional(),
  phone: z7.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  alternatePhone: z7.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number").optional(),
  gender: z7.enum(["male", "female", "other"]).optional(),
  occupation: z7.string().max(100).optional(),
  dateOfBirth: z7.string().transform((str) => new Date(str)).optional(),
  aadhaarNumber: z7.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits").optional(),
  panNumber: z7.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format").optional(),
  permanentAddress: z7.string().optional(),
  permanentAddressCity: z7.string().optional(),
  permanentAddressState: z7.string().optional(),
  permanentAddressPincode: z7.string().optional(),
  /** Precise target, from the structure view. */
  bedId: z7.string().uuid().optional(),
  /** Older shape: name a room and the first vacant bed in it is used. */
  roomId: z7.string().uuid().optional(),
  joiningDate: z7.string().transform((str) => new Date(str)),
  monthlyRentOverride: z7.number().min(0).optional(),
  deposit: z7.number().min(0).optional(),
  notes: z7.string().optional()
});
var updateTenantSchema = createTenantSchema.partial().extend({
  status: z7.enum(["pending", "active", "vacating", "vacated", "rejected"]).optional(),
  vacatingDate: z7.string().transform((str) => new Date(str)).optional()
});
var assignSchema = z7.object({
  bedId: z7.string().uuid().optional(),
  roomId: z7.string().uuid().optional()
}).refine((value) => value.bedId || value.roomId, {
  message: "Provide a bed or a room to assign"
});
router8.use(requireAuth, requireOwner, requireProperty);
function tenantSelection() {
  return {
    tenant,
    bedNumber: bed.number,
    roomNumber: room.number
  };
}
router8.get("/", async (req, res) => {
  try {
    const status = req.query.status;
    const where = status ? and10(eq11(tenant.propertyId, req.propertyId), eq11(tenant.status, status)) : eq11(tenant.propertyId, req.propertyId);
    const tenants = await db.select(tenantSelection()).from(tenant).leftJoin(bed, eq11(tenant.bedId, bed.id)).leftJoin(room, eq11(tenant.roomId, room.id)).where(where).orderBy(asc7(tenant.name));
    res.json(
      tenants.map((row) => ({
        ...row.tenant,
        bedNumber: row.bedNumber,
        roomNumber: row.roomNumber
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});
router8.get("/:tenantId", async (req, res) => {
  try {
    const [row] = await db.select(tenantSelection()).from(tenant).leftJoin(bed, eq11(tenant.bedId, bed.id)).leftJoin(room, eq11(tenant.roomId, room.id)).where(
      and10(
        eq11(tenant.id, param(req, "tenantId")),
        eq11(tenant.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!row) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json({
      ...row.tenant,
      bedNumber: row.bedNumber,
      roomNumber: row.roomNumber
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});
router8.post("/", async (req, res, next) => {
  try {
    const body = createTenantSchema.parse(req.body);
    const [existingPhone] = await db.select().from(tenant).where(and10(eq11(tenant.phone, body.phone), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (existingPhone) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    const { bedId, roomId, ...fields } = body;
    let requestedRoomId = roomId;
    if (bedId && !roomId) {
      const [b] = await db.select({ roomId: bed.roomId }).from(bed).where(eq11(bed.id, bedId)).limit(1);
      requestedRoomId = b?.roomId;
    }
    const [newTenant] = await db.insert(tenant).values({
      ...fields,
      propertyId: req.propertyId,
      status: "pending",
      requestedRoomId: requestedRoomId || null
    }).returning();
    if (!newTenant) {
      return res.status(500).json({ error: "Failed to create tenant" });
    }
    res.status(201).json(newTenant);
  } catch (error) {
    if (error instanceof z7.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    next(error);
  }
});
router8.post("/:tenantId/assign-bed", async (req, res, next) => {
  try {
    const body = assignSchema.parse(req.body);
    const tenantId = param(req, "tenantId");
    const [target] = await db.select({ id: tenant.id, status: tenant.status }).from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Tenant not found" });
    if (target.status === "vacated") {
      return res.status(409).json({ error: "Tenant has vacated. Reactivate before assigning a bed." });
    }
    const outcome = await assignTenantToBed(req.propertyId, tenantId, body);
    res.json({
      message: `Assigned to bed ${outcome.roomNumber}-${outcome.bedNumber}`,
      ...outcome
    });
  } catch (error) {
    if (error instanceof z7.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to assign bed" });
  }
});
router8.post("/:tenantId/vacate-bed", async (req, res, next) => {
  try {
    const result = await vacateTenantBed(req.propertyId, param(req, "tenantId"));
    res.json({
      message: result.freedBedId ? "Bed released" : "Tenant held no bed",
      ...result
    });
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to release bed" });
  }
});
async function decideApproval(req, res, next, decision) {
  try {
    const tenantId = param(req, "tenantId");
    const [target] = await db.select().from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Tenant not found" });
    const result = decideTenantApproval(target, decision);
    if (!result.ok) {
      return res.status(409).json({ error: "This tenant has already been decided" });
    }
    if (decision === "reject") {
      const [updated2] = await db.update(tenant).set({ status: "rejected", updatedAt: /* @__PURE__ */ new Date() }).where(eq11(tenant.id, tenantId)).returning();
      return res.json(updated2);
    }
    if (target.requestedRoomId) {
      await assignTenantToBed(req.propertyId, tenantId, { roomId: target.requestedRoomId });
    }
    const [updated] = await db.update(tenant).set({
      status: "active",
      onboardingToken: generateOnboardingToken(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq11(tenant.id, tenantId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: `Failed to ${decision} tenant` });
  }
}
router8.post(
  "/:tenantId/approve",
  (req, res, next) => decideApproval(req, res, next, "approve")
);
router8.post(
  "/:tenantId/reject",
  (req, res, next) => decideApproval(req, res, next, "reject")
);
router8.post("/:tenantId/onboarding-link", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [target] = await db.select({ id: tenant.id, status: tenant.status }).from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Tenant not found" });
    if (target.status !== "active") {
      return res.status(409).json({ error: "Only an approved tenant can have an onboarding link" });
    }
    const onboardingToken = generateOnboardingToken();
    await db.update(tenant).set({ onboardingToken, updatedAt: /* @__PURE__ */ new Date() }).where(eq11(tenant.id, tenantId));
    res.json({ onboardingToken });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate onboarding link" });
  }
});
router8.put("/:tenantId", async (req, res, next) => {
  try {
    const body = updateTenantSchema.parse(req.body);
    const tenantId = param(req, "tenantId");
    const [existing] = await db.select().from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const { bedId, roomId, ...fields } = body;
    const vacating = fields.status === "vacated" && existing.status !== "vacated";
    const [updated] = await db.update(tenant).set({ ...fields, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).returning();
    if (vacating) {
      await vacateTenantBed(req.propertyId, tenantId);
    } else if (bedId || roomId) {
      const outcome = await assignTenantToBed(req.propertyId, tenantId, {
        bedId,
        roomId
      });
      return res.json({
        ...updated,
        bedId: outcome.bedId,
        roomId: outcome.roomId,
        bedNumber: outcome.bedNumber,
        roomNumber: outcome.roomNumber
      });
    }
    const [fresh] = await db.select().from(tenant).where(eq11(tenant.id, tenantId)).limit(1);
    res.json(fresh);
  } catch (error) {
    if (error instanceof z7.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});
router8.delete("/:tenantId", async (req, res, next) => {
  try {
    const tenantId = param(req, "tenantId");
    const [existing] = await db.select({ id: tenant.id, bedId: tenant.bedId }).from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    await db.transaction(async (tx) => {
      if (existing.bedId) {
        await tx.update(tenant).set({ bedId: null, roomId: null }).where(eq11(tenant.id, tenantId));
        await tx.update(bed).set({ status: "vacant", updatedAt: /* @__PURE__ */ new Date() }).where(eq11(bed.id, existing.bedId));
      }
      await tx.delete(tenant).where(eq11(tenant.id, tenantId));
    });
    res.json({ message: "Tenant deleted" });
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});
router8.get("/:tenantId/checkout-preview", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [t] = await db.select().from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const bills = await db.select({ totalAmount: bill.totalAmount, paidAmount: bill.paidAmount, balance: bill.balance }).from(bill).where(eq11(bill.tenantId, tenantId));
    const [deposit] = await db.select().from(securityDeposit).where(eq11(securityDeposit.tenantId, tenantId)).limit(1);
    const advances = await db.select().from(advancePayment).where(eq11(advancePayment.tenantId, tenantId));
    const preview = calculateCheckoutPreview({
      outstandingBills: bills,
      securityDeposit: deposit ?? null,
      advancePayments: advances
    });
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate checkout preview" });
  }
});
router8.post("/:tenantId/transfer", async (req, res, next) => {
  try {
    const tenantId = param(req, "tenantId");
    const { bedId } = z7.object({ bedId: z7.string().uuid() }).parse(req.body);
    const [t] = await db.select().from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const [newBed] = await db.select({ id: bed.id, status: bed.status, roomId: bed.roomId }).from(bed).innerJoin(room, eq11(bed.roomId, room.id)).where(and10(eq11(bed.id, bedId), eq11(room.propertyId, req.propertyId))).limit(1);
    if (!newBed) return res.status(404).json({ error: "Bed not found" });
    const validation = validateTransfer(t.bedId, bedId, newBed.status);
    if (!validation.ok) {
      return res.status(409).json({ error: validation.reason });
    }
    const outcome = await assignTenantToBed(req.propertyId, tenantId, { bedId });
    res.json({ message: `Transferred to bed ${outcome.roomNumber}-${outcome.bedNumber}`, ...outcome });
  } catch (error) {
    if (error instanceof z7.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to transfer bed" });
  }
});
router8.get("/:tenantId/financial-report", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [t] = await db.select().from(tenant).where(and10(eq11(tenant.id, tenantId), eq11(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const bills = await db.select().from(bill).where(eq11(bill.tenantId, tenantId)).orderBy(asc7(bill.billMonth));
    const payments = await db.select().from(payment).innerJoin(bill, eq11(payment.billId, bill.id)).where(eq11(bill.tenantId, tenantId));
    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalBalance = bills.reduce((sum, b) => sum + b.balance, 0);
    res.json({
      tenant: { id: t.id, name: t.name, phone: t.phone, status: t.status },
      summary: { totalBilled, totalPaid, totalBalance },
      bills,
      payments: payments.map((p) => p.payment)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate financial report" });
  }
});
var tenants_default = router8;

// src/routes/readings.ts
import { Router as Router9 } from "express";
import { z as z8 } from "zod";
import { eq as eq12, and as and11, asc as asc8, desc } from "drizzle-orm";
var router9 = Router9({ mergeParams: true });
var createReadingSchema = z8.object({
  roomId: z8.string().uuid(),
  reading: z8.number().min(0),
  readingDate: z8.string().transform((str) => new Date(str))
});
var updateReadingSchema = createReadingSchema.pick({ reading: true, readingDate: true });
var listReadingsSchema = z8.object({
  roomId: z8.string().uuid().optional()
});
router9.use(requireAuth, requireOwner, requireProperty);
async function ownedRoom(propertyId, roomId) {
  const [r] = await db.select().from(room).where(and11(eq12(room.id, roomId), eq12(room.propertyId, propertyId))).limit(1);
  return r;
}
async function ownedReading(propertyId, readingId) {
  const [result] = await db.select({ reading: electricityReading }).from(electricityReading).innerJoin(room, eq12(electricityReading.roomId, room.id)).where(and11(eq12(electricityReading.id, readingId), eq12(room.propertyId, propertyId))).limit(1);
  return result?.reading;
}
function validateReadingPosition(reading, readingDate, previous, next) {
  if (previous && readingDate <= previous.readingDate) {
    return "Reading date must be after the previous reading date";
  }
  if (next && readingDate >= next.readingDate) {
    return "Reading date must be before the next reading date";
  }
  if (previous && reading < previous.reading) {
    return "Reading cannot be less than the previous reading";
  }
  if (next && reading > next.reading) {
    return "Reading cannot be greater than the next reading";
  }
  return void 0;
}
router9.get("/", async (req, res) => {
  try {
    const { roomId } = listReadingsSchema.parse(req.query);
    if (roomId) {
      if (!await ownedRoom(req.propertyId, roomId)) {
        return res.status(404).json({ error: "Room not found" });
      }
      const readings2 = await db.select().from(electricityReading).where(eq12(electricityReading.roomId, roomId)).orderBy(desc(electricityReading.readingDate));
      return res.json(readings2);
    }
    const readings = await db.select({
      reading: electricityReading,
      roomNumber: room.number
    }).from(electricityReading).innerJoin(room, eq12(electricityReading.roomId, room.id)).where(eq12(room.propertyId, req.propertyId)).orderBy(desc(electricityReading.readingDate));
    res.json(readings);
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});
router9.post("/", async (req, res) => {
  try {
    const body = createReadingSchema.parse(req.body);
    const r = await ownedRoom(req.propertyId, body.roomId);
    if (!r) return res.status(404).json({ error: "Room not found" });
    const [lastReading] = await db.select().from(electricityReading).where(eq12(electricityReading.roomId, body.roomId)).orderBy(desc(electricityReading.readingDate)).limit(1);
    if (lastReading && body.readingDate <= lastReading.readingDate) {
      return res.status(400).json({
        error: "Reading date must be after the previous reading date"
      });
    }
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
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create reading" });
  }
});
router9.patch("/:readingId", async (req, res) => {
  try {
    const body = updateReadingSchema.parse(req.body);
    const readingId = z8.string().uuid().parse(req.params.readingId);
    const current = await ownedReading(req.propertyId, readingId);
    if (!current) return res.status(404).json({ error: "Reading not found" });
    const readings = await db.select().from(electricityReading).where(eq12(electricityReading.roomId, current.roomId)).orderBy(asc8(electricityReading.readingDate));
    const index2 = readings.findIndex((reading) => reading.id === current.id);
    const previous = index2 > 0 ? readings[index2 - 1] : void 0;
    const next = index2 >= 0 ? readings[index2 + 1] : void 0;
    const validationError = validateReadingPosition(body.reading, body.readingDate, previous, next);
    if (validationError) return res.status(400).json({ error: validationError });
    const [updated] = await db.transaction(async (tx) => {
      const [updatedReading] = await tx.update(electricityReading).set({
        reading: body.reading,
        readingDate: body.readingDate,
        units: previous ? body.reading - previous.reading : 0
      }).where(eq12(electricityReading.id, current.id)).returning();
      if (next) {
        await tx.update(electricityReading).set({ units: next.reading - body.reading }).where(eq12(electricityReading.id, next.id));
      }
      return [updatedReading];
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update reading" });
  }
});
router9.delete("/:readingId", async (req, res) => {
  try {
    const readingId = z8.string().uuid().parse(req.params.readingId);
    const current = await ownedReading(req.propertyId, readingId);
    if (!current) return res.status(404).json({ error: "Reading not found" });
    const readings = await db.select().from(electricityReading).where(eq12(electricityReading.roomId, current.roomId)).orderBy(asc8(electricityReading.readingDate));
    const index2 = readings.findIndex((reading) => reading.id === current.id);
    const previous = index2 > 0 ? readings[index2 - 1] : void 0;
    const next = index2 >= 0 ? readings[index2 + 1] : void 0;
    await db.transaction(async (tx) => {
      if (next) {
        await tx.update(electricityReading).set({ units: previous ? next.reading - previous.reading : 0 }).where(eq12(electricityReading.id, next.id));
      }
      await tx.delete(electricityReading).where(eq12(electricityReading.id, current.id));
    });
    res.json({ message: "Reading deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete reading" });
  }
});
var readings_default = router9;

// src/routes/billing.ts
import { Router as Router10 } from "express";
import { z as z9 } from "zod";
import { eq as eq13, and as and12, sql as sql5, inArray as inArray5 } from "drizzle-orm";

// src/lib/rent.ts
function resolveMonthlyRent(inputs) {
  if (inputs.tenantOverride !== null && inputs.tenantOverride !== void 0) {
    return { amount: inputs.tenantOverride, source: "tenant-override" };
  }
  if (inputs.bedRent !== null && inputs.bedRent !== void 0) {
    return { amount: inputs.bedRent, source: "bed" };
  }
  if (inputs.planRent !== null && inputs.planRent !== void 0) {
    return { amount: inputs.planRent, source: "rent-plan" };
  }
  return { amount: inputs.roomRent, source: "room" };
}

// src/lib/billing-calculator.ts
function calculateBill(inputs) {
  const lineItems = [];
  const { amount: monthlyRent } = resolveMonthlyRent(inputs.rent);
  const rentAmount = Math.round(monthlyRent * Math.max(0, Math.min(1, inputs.rent.proration ?? 1)));
  lineItems.push({ code: "RENT", name: "Rent", amount: rentAmount });
  const electricityAmount = calculateElectricity(inputs.electricity);
  if (electricityAmount > 0 || inputs.electricity.ratePerUnit) {
    lineItems.push({
      code: "ELEC",
      name: "Electricity",
      amount: electricityAmount,
      units: Math.max(0, inputs.electricity.unitsForMonth ?? 0),
      ratePerUnit: Math.max(0, inputs.electricity.ratePerUnit ?? 0)
    });
  }
  for (const charge of inputs.recurringCharges) {
    lineItems.push({ code: charge.code, name: charge.name, amount: charge.amount });
  }
  const totalAmount = lineItems.reduce((sum, line) => sum + line.amount, 0);
  return { lineItems, totalAmount, rentAmount, electricityAmount };
}
function calculateElectricity(inputs) {
  if (!inputs.ratePerUnit || !inputs.unitsForMonth) return 0;
  const share = inputs.occupancyShare ?? 1 / Math.max(1, inputs.occupants);
  return Math.round(inputs.unitsForMonth * inputs.ratePerUnit * Math.max(0, Math.min(1, share)));
}

// src/lib/electricity.ts
function readingForMonth(readings, billMonth) {
  const matches = readings.filter((reading) => monthOf(reading.readingDate) === billMonth);
  if (matches.length === 0) return void 0;
  return matches.reduce(
    (latest, candidate) => new Date(candidate.readingDate) > new Date(latest.readingDate) ? candidate : latest
  );
}
function readingPairForMonth(readings, billMonth) {
  const second = readingForMonth(readings, billMonth);
  if (!second) return void 0;
  const secondTime = new Date(second.readingDate).getTime();
  const first = readings.filter((reading) => new Date(reading.readingDate).getTime() < secondTime).reduce(
    (latest, candidate) => !latest || new Date(candidate.readingDate) > new Date(latest.readingDate) ? candidate : latest,
    void 0
  );
  if (!first || second.reading < first.reading) return void 0;
  return { first, second, units: second.reading - first.reading };
}
function occupiedDaysInReadingPeriod(joiningDate, firstReadingDate, secondReadingDate) {
  const joining = new Date(joiningDate).getTime();
  const first = new Date(firstReadingDate).getTime();
  const second = new Date(secondReadingDate).getTime();
  if (!Number.isFinite(joining) || !Number.isFinite(first) || !Number.isFinite(second) || second <= first) {
    return 0;
  }
  return Math.max(0, second - Math.max(first, joining)) / (24 * 60 * 60 * 1e3);
}
function rentProrationForMonth(joiningDate, billMonth) {
  const match = /^(\d{4})-(\d{2})$/.exec(billMonth);
  if (!match) return 1;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = Date.UTC(year, monthIndex, 1);
  const end = Date.UTC(year, monthIndex + 1, 1);
  const joining = new Date(joiningDate).getTime();
  if (!Number.isFinite(joining)) return 1;
  if (joining <= start) return 1;
  if (joining >= end) return 0;
  return (end - joining) / (end - start);
}
function monthOf(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// src/lib/due-date.ts
function computeDueDate(issueDate, daysAfterIssue = 5) {
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + daysAfterIssue);
  return dueDate;
}

// src/lib/late-fee.ts
function calculateLateFee(inputs) {
  if (!inputs.dueDate || !inputs.lateFeePerDay || inputs.lateFeePerDay <= 0) {
    return { amount: 0, daysOverdue: 0 };
  }
  if (inputs.balance <= 0 || inputs.voidedAt) {
    return { amount: 0, daysOverdue: 0 };
  }
  const due = startOfDay(inputs.dueDate);
  const asOf = startOfDay(inputs.asOf);
  if (inputs.promisedDate) {
    const promised = startOfDay(inputs.promisedDate);
    if (asOf.getTime() < promised.getTime()) {
      return { amount: 0, daysOverdue: 0 };
    }
  }
  const msPerDay = 24 * 60 * 60 * 1e3;
  const daysOverdue2 = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);
  if (daysOverdue2 <= 0) {
    return { amount: 0, daysOverdue: 0 };
  }
  return { amount: daysOverdue2 * inputs.lateFeePerDay, daysOverdue: daysOverdue2 };
}
function startOfDay(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// src/routes/billing.ts
var router10 = Router10({ mergeParams: true });
var generateBillsSchema = z9.object({
  month: z9.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
  tenantId: z9.string().uuid().optional()
});
var applyLateFeesSchema = z9.object({
  billIds: z9.array(z9.string().uuid()).optional(),
  asOf: z9.string().optional()
});
router10.use(requireAuth, requireOwner, requireProperty);
router10.get("/", async (req, res) => {
  try {
    const month = req.query.month;
    const where = month ? and12(eq13(tenant.propertyId, req.propertyId), eq13(bill.billMonth, month)) : eq13(tenant.propertyId, req.propertyId);
    const bills = await db.select({
      bill,
      tenantName: tenant.name,
      roomNumber: room.number
    }).from(bill).innerJoin(tenant, eq13(bill.tenantId, tenant.id)).leftJoin(room, eq13(tenant.roomId, room.id)).where(where);
    res.json(
      bills.map((row) => ({
        ...row.bill,
        tenantName: row.tenantName,
        roomNumber: row.roomNumber
      }))
    );
  } catch (error) {
    console.error("[Billing] List error:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});
router10.get("/:billId", async (req, res) => {
  try {
    const [row] = await db.select({
      bill,
      tenantName: tenant.name,
      roomNumber: room.number
    }).from(bill).innerJoin(tenant, eq13(bill.tenantId, tenant.id)).leftJoin(room, eq13(tenant.roomId, room.id)).where(
      and12(eq13(bill.id, param(req, "billId")), eq13(tenant.propertyId, req.propertyId))
    ).limit(1);
    if (!row) return res.status(404).json({ error: "Bill not found" });
    res.json({ ...row.bill, tenantName: row.tenantName, roomNumber: row.roomNumber });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});
router10.post("/generate", async (req, res) => {
  try {
    const { month, tenantId } = generateBillsSchema.parse(req.body);
    const prop = req.property;
    const tenantFilter = tenantId ? and12(eq13(tenant.propertyId, req.propertyId), eq13(tenant.status, "active"), eq13(tenant.id, tenantId)) : and12(eq13(tenant.propertyId, req.propertyId), eq13(tenant.status, "active"));
    const activeTenants = await db.select({ tenant, room, bed, plan: rentPlan }).from(tenant).leftJoin(room, eq13(tenant.roomId, room.id)).leftJoin(bed, eq13(tenant.bedId, bed.id)).leftJoin(rentPlan, eq13(room.rentPlanId, rentPlan.id)).where(tenantFilter);
    const recurringCharges = await db.select({ code: chargeType.code, name: chargeType.name, amount: chargeType.defaultAmount }).from(chargeType).where(
      and12(
        eq13(chargeType.propertyId, req.propertyId),
        eq13(chargeType.isRecurring, true),
        eq13(chargeType.isActive, true),
        sql5`${chargeType.code} <> 'ELEC'`
      )
    );
    const roomIds = [
      ...new Set(activeTenants.map((row) => row.room?.id).filter((id) => Boolean(id)))
    ];
    const readingsByRoom = /* @__PURE__ */ new Map();
    if (roomIds.length > 0) {
      const readings = await db.select({
        roomId: electricityReading.roomId,
        readingDate: electricityReading.readingDate,
        reading: electricityReading.reading
      }).from(electricityReading).where(inArray5(electricityReading.roomId, roomIds));
      for (const r of readings) {
        const bucket = readingsByRoom.get(r.roomId);
        if (bucket) bucket.push(r);
        else readingsByRoom.set(r.roomId, [r]);
      }
    }
    const tenantsByRoom = /* @__PURE__ */ new Map();
    for (const row of activeTenants) {
      if (!row.room) continue;
      const occupants = tenantsByRoom.get(row.room.id);
      if (occupants) occupants.push(row);
      else tenantsByRoom.set(row.room.id, [row]);
    }
    const issuedAt = /* @__PURE__ */ new Date();
    const dueDate = computeDueDate(issuedAt);
    const { generatedBills, skipped } = await db.transaction(async (tx) => {
      const generatedBills2 = [];
      let skipped2 = 0;
      for (const { tenant: t, room: r, bed: b, plan } of activeTenants) {
        if (!r) continue;
        const rentProration = rentProrationForMonth(t.joiningDate, month);
        if (rentProration === 0) continue;
        const readingPair = readingPairForMonth(
          readingsByRoom.get(r.id) ?? [],
          month
        );
        const roomOccupants = tenantsByRoom.get(r.id) ?? [];
        const totalOccupancyDays = readingPair ? roomOccupants.reduce(
          (sum, occupant) => sum + occupiedDaysInReadingPeriod(
            occupant.tenant.joiningDate,
            readingPair.first.readingDate,
            readingPair.second.readingDate
          ),
          0
        ) : 0;
        const tenantOccupancyDays = readingPair ? occupiedDaysInReadingPeriod(
          t.joiningDate,
          readingPair.first.readingDate,
          readingPair.second.readingDate
        ) : 0;
        const calculated = calculateBill({
          rent: {
            tenantOverride: t.monthlyRentOverride,
            bedRent: b?.monthlyRent,
            planRent: plan?.monthlyRent,
            roomRent: r.monthlyRent,
            proration: rentProration
          },
          electricity: {
            ratePerUnit: prop.electricityRatePerUnit,
            unitsForMonth: readingPair?.units,
            occupants: roomOccupants.length || 1,
            occupancyShare: totalOccupancyDays > 0 ? tenantOccupancyDays / totalOccupancyDays : void 0
          },
          recurringCharges
        });
        const [existingBill] = await tx.select({ id: bill.id, voidedAt: bill.voidedAt }).from(bill).where(and12(eq13(bill.tenantId, t.id), eq13(bill.billMonth, month))).limit(1);
        if (existingBill) {
          if (existingBill.voidedAt) {
            await tx.delete(bill).where(eq13(bill.id, existingBill.id));
          } else {
            skipped2 += 1;
            continue;
          }
        }
        const [newBill] = await tx.insert(bill).values({
          tenantId: t.id,
          billMonth: month,
          rentAmount: calculated.rentAmount,
          electricityAmount: calculated.electricityAmount,
          lineItems: calculated.lineItems,
          totalAmount: calculated.totalAmount,
          balance: calculated.totalAmount,
          dueDate,
          createdAt: issuedAt,
          approved: false
        }).returning();
        if (newBill) {
          generatedBills2.push(newBill);
        } else {
          skipped2 += 1;
        }
      }
      return { generatedBills: generatedBills2, skipped: skipped2 };
    });
    res.status(201).json({
      message: `Generated ${generatedBills.length} bills`,
      generated: generatedBills.length,
      skipped,
      bills: generatedBills
    });
  } catch (error) {
    if (error instanceof z9.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate bills" });
  }
});
router10.post("/apply-late-fees", async (req, res) => {
  try {
    const body = applyLateFeesSchema.parse(req.body);
    const asOf = body.asOf ? new Date(body.asOf) : /* @__PURE__ */ new Date();
    const targetBills = await db.select({
      bill,
      plan: rentPlan
    }).from(bill).innerJoin(tenant, eq13(bill.tenantId, tenant.id)).leftJoin(room, eq13(tenant.roomId, room.id)).leftJoin(rentPlan, eq13(room.rentPlanId, rentPlan.id)).where(
      and12(
        eq13(tenant.propertyId, req.propertyId),
        body.billIds ? inArray5(bill.id, body.billIds) : sql5`true`
      )
    );
    const updatedBills = await db.transaction(async (tx) => {
      const updated = [];
      for (const { bill: b, plan } of targetBills) {
        const { amount, daysOverdue: daysOverdue2 } = calculateLateFee({
          dueDate: b.dueDate,
          lateFeePerDay: plan?.lateFeePerDay,
          asOf,
          balance: b.balance,
          voidedAt: b.voidedAt,
          promisedDate: b.promisedDate
        });
        const withoutLateFee = b.lineItems.filter(
          (line) => line.code !== "LATE"
        );
        if (amount <= 0) {
          if (withoutLateFee.length !== b.lineItems.length) {
            const totalAmount2 = withoutLateFee.reduce((sum, line) => sum + line.amount, 0);
            const [row2] = await tx.update(bill).set({
              lineItems: withoutLateFee,
              totalAmount: totalAmount2,
              balance: Math.max(0, totalAmount2 - b.paidAmount),
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq13(bill.id, b.id)).returning();
            if (row2) updated.push(row2);
          }
          continue;
        }
        const lineItems = [
          ...withoutLateFee,
          { code: "LATE", name: `Late fee (${daysOverdue2}d)`, amount }
        ];
        const totalAmount = lineItems.reduce((sum, line) => sum + line.amount, 0);
        const [row] = await tx.update(bill).set({
          lineItems,
          totalAmount,
          balance: Math.max(0, totalAmount - b.paidAmount),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq13(bill.id, b.id)).returning();
        if (row) updated.push(row);
      }
      return updated;
    });
    res.json({
      message: `Updated late fees on ${updatedBills.length} bill${updatedBills.length === 1 ? "" : "s"}`,
      updated: updatedBills.length,
      bills: updatedBills
    });
  } catch (error) {
    if (error instanceof z9.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to apply late fees" });
  }
});
router10.patch("/:billId/promised-date", async (req, res) => {
  try {
    const billId = param(req, "billId");
    const { promisedDate } = z9.object({ promisedDate: z9.string().nullable().optional() }).parse(req.body);
    const [target] = await db.select({ bill }).from(bill).innerJoin(tenant, eq13(bill.tenantId, tenant.id)).where(and12(eq13(bill.id, billId), eq13(tenant.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Bill not found" });
    const [updated] = await db.update(bill).set({
      promisedDate: promisedDate ? new Date(promisedDate) : null,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(bill.id, billId)).returning();
    res.json({ message: promisedDate ? "Promised date set" : "Promised date cleared", bill: updated });
  } catch (error) {
    if (error instanceof z9.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update promised date" });
  }
});
router10.delete("/:billId", async (req, res) => {
  try {
    const billId = param(req, "billId");
    const [target] = await db.select({ bill }).from(bill).innerJoin(tenant, eq13(bill.tenantId, tenant.id)).where(and12(eq13(bill.id, billId), eq13(tenant.propertyId, req.propertyId))).limit(1);
    if (!target) return res.status(404).json({ error: "Bill not found" });
    await db.transaction(async (tx) => {
      await tx.delete(payment).where(eq13(payment.billId, billId));
      await tx.delete(bill).where(eq13(bill.id, billId));
    });
    res.json({ message: "Bill deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bill" });
  }
});
router10.post("/approve", async (req, res) => {
  try {
    const { billIds } = z9.object({ billIds: z9.array(z9.string().uuid()) }).parse(req.body);
    const approved = await db.update(bill).set({ approved: true, updatedAt: /* @__PURE__ */ new Date() }).where(
      and12(
        inArray5(bill.id, billIds),
        inArray5(
          bill.tenantId,
          db.select({ id: tenant.id }).from(tenant).where(eq13(tenant.propertyId, req.propertyId))
        )
      )
    ).returning();
    res.json({ message: `Approved ${approved.length} bills`, bills: approved });
  } catch (error) {
    if (error instanceof z9.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to approve bills" });
  }
});
var billing_default = router10;

// src/routes/payments.ts
import { Router as Router11 } from "express";
import { z as z10 } from "zod";
import { eq as eq14, and as and13, sql as sql6, asc as asc9 } from "drizzle-orm";

// src/lib/auto-allocate.ts
function autoAllocatePayment(amount, bills) {
  const sorted = [...bills].sort((a, b) => a.billMonth.localeCompare(b.billMonth));
  const allocations = [];
  let remaining = amount;
  for (const b of sorted) {
    if (remaining <= 0) break;
    if (b.balance <= 0) continue;
    const allocation = Math.min(remaining, b.balance);
    allocations.push({ billId: b.id, amount: allocation });
    remaining -= allocation;
  }
  return allocations;
}

// src/routes/payments.ts
var router11 = Router11({ mergeParams: true });
var recordPaymentSchema = z10.object({
  billId: z10.string().uuid(),
  amount: z10.number().min(1),
  paymentDate: z10.string().transform((str) => new Date(str)),
  method: z10.enum(["cash", "upi", "bank_transfer", "advance", "other"]).optional(),
  notes: z10.string().optional(),
  idempotencyKey: z10.string().optional()
});
router11.use(requireAuth, requireOwner, requireProperty);
async function syncBillTotals(billId, totalAmount, tx) {
  const dbConn = tx || db;
  const { totalPaid } = aggregate(
    await dbConn.select({ totalPaid: sql6`coalesce(sum(${payment.amount}), 0)::int` }).from(payment).where(eq14(payment.billId, billId)),
    { totalPaid: 0 }
  );
  const newBalance = totalAmount - totalPaid;
  const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
  await dbConn.update(bill).set({
    paidAmount: totalPaid,
    balance: Math.max(0, newBalance),
    status: newStatus,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq14(bill.id, billId));
  return { totalPaid, balance: newBalance, status: newStatus };
}
router11.get("/", async (req, res) => {
  try {
    const payments = await db.select({
      payment,
      tenantName: tenant.name,
      billMonth: bill.billMonth
    }).from(payment).innerJoin(bill, eq14(payment.billId, bill.id)).innerJoin(tenant, eq14(bill.tenantId, tenant.id)).where(eq14(tenant.propertyId, req.propertyId));
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});
router11.post("/", async (req, res) => {
  try {
    const body = recordPaymentSchema.parse(req.body);
    const [b] = await db.select({ bill }).from(bill).innerJoin(tenant, eq14(bill.tenantId, tenant.id)).where(
      and13(eq14(bill.id, body.billId), eq14(tenant.propertyId, req.propertyId))
    ).limit(1);
    if (!b) return res.status(404).json({ error: "Bill not found" });
    const result = await db.transaction(async (tx) => {
      if (body.idempotencyKey) {
        const [existing] = await tx.select({ id: payment.id }).from(payment).where(
          and13(
            eq14(payment.billId, body.billId),
            eq14(payment.idempotencyKey, body.idempotencyKey)
          )
        ).limit(1);
        if (existing) {
          return { type: "duplicate", id: existing.id };
        }
      }
      const [newPayment] = await tx.insert(payment).values({
        billId: body.billId,
        amount: body.amount,
        paymentDate: body.paymentDate,
        method: body.method,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey
      }).returning();
      await syncBillTotals(body.billId, b.bill.totalAmount, tx);
      return { type: "created", payment: newPayment };
    });
    if (result.type === "duplicate") {
      return res.status(200).json({ message: "Payment already recorded", id: result.id });
    }
    res.status(201).json(result.payment);
  } catch (error) {
    if (error instanceof z10.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record payment" });
  }
});
router11.delete("/:paymentId", async (req, res) => {
  try {
    const paymentId = param(req, "paymentId");
    const [owned] = await db.select({ id: payment.id, billId: payment.billId }).from(payment).innerJoin(bill, eq14(payment.billId, bill.id)).innerJoin(tenant, eq14(bill.tenantId, tenant.id)).where(and13(eq14(payment.id, paymentId), eq14(tenant.propertyId, req.propertyId))).limit(1);
    if (!owned) return res.status(404).json({ error: "Payment not found" });
    await db.delete(payment).where(eq14(payment.id, paymentId));
    const [b] = await db.select().from(bill).where(eq14(bill.id, owned.billId)).limit(1);
    if (b) {
      await syncBillTotals(b.id, b.totalAmount);
    }
    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});
router11.post("/auto-allocate", async (req, res) => {
  try {
    const { tenantId, amount, paymentDate, method, notes } = z10.object({
      tenantId: z10.string().uuid(),
      amount: z10.number().min(1),
      paymentDate: z10.string().transform((str) => new Date(str)),
      method: z10.enum(["cash", "upi", "bank_transfer", "other"]).optional(),
      notes: z10.string().optional()
    }).parse(req.body);
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(and13(eq14(tenant.id, tenantId), eq14(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const outstandingBills = await db.select({ id: bill.id, balance: bill.balance, billMonth: bill.billMonth }).from(bill).where(and13(eq14(bill.tenantId, tenantId), sql6`${bill.balance} > 0`)).orderBy(asc9(bill.billMonth));
    if (outstandingBills.length === 0) {
      return res.status(409).json({ error: "No outstanding bills" });
    }
    const allocations = autoAllocatePayment(amount, outstandingBills);
    if (allocations.length === 0) {
      return res.status(409).json({ error: "Amount too small to allocate" });
    }
    const results = await db.transaction(async (tx) => {
      const created = [];
      for (const alloc of allocations) {
        const [p] = await tx.insert(payment).values({
          billId: alloc.billId,
          amount: alloc.amount,
          paymentDate,
          method,
          notes: notes ? `Auto-allocated: ${notes}` : "Auto-allocated"
        }).returning();
        created.push(p);
        const [b] = await tx.select({ totalAmount: bill.totalAmount }).from(bill).where(eq14(bill.id, alloc.billId)).limit(1);
        if (b) {
          await syncBillTotals(alloc.billId, b.totalAmount);
        }
      }
      return created;
    });
    res.status(201).json({
      message: `Allocated across ${results.length} bills`,
      allocations: results
    });
  } catch (error) {
    if (error instanceof z10.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to auto-allocate payment" });
  }
});
var payments_default = router11;

// src/routes/advance-payments.ts
import { Router as Router12 } from "express";
import { z as z11 } from "zod";
import { eq as eq15, and as and14, desc as desc2 } from "drizzle-orm";

// src/lib/advance-payment.ts
function availableBalance(advance) {
  return advance.amount - advance.appliedAmount;
}
function applyAdvanceToBill(inputs) {
  if (inputs.advance.status === "forfeited") {
    return { ok: false, reason: "forfeited" };
  }
  const available = availableBalance(inputs.advance);
  if (available <= 0) {
    return { ok: false, reason: "nothing-available" };
  }
  const requested = inputs.requestedAmount ?? Math.min(available, inputs.billBalance);
  if (requested > available) {
    return { ok: false, reason: "exceeds-available" };
  }
  if (requested > inputs.billBalance) {
    return { ok: false, reason: "exceeds-bill-balance" };
  }
  if (requested <= 0) {
    return { ok: false, reason: "nothing-available" };
  }
  const newAppliedAmount = inputs.advance.appliedAmount + requested;
  return {
    ok: true,
    amountApplied: requested,
    newAppliedAmount,
    newAdvanceStatus: newAppliedAmount >= inputs.advance.amount ? "applied" : "available",
    newBillBalance: inputs.billBalance - requested
  };
}

// src/routes/advance-payments.ts
var router12 = Router12({ mergeParams: true });
var createSchema2 = z11.object({
  tenantId: z11.string().uuid(),
  amount: z11.number().int().min(1),
  date: z11.string().transform((str) => new Date(str)).optional(),
  notes: z11.string().optional()
});
var applySchema = z11.object({
  billId: z11.string().uuid(),
  amount: z11.number().int().min(1).optional()
});
router12.use(requireAuth, requireOwner, requireProperty);
async function ownedTenant(propertyId, tenantId) {
  const [t] = await db.select({ id: tenant.id }).from(tenant).where(and14(eq15(tenant.id, tenantId), eq15(tenant.propertyId, propertyId))).limit(1);
  return t;
}
async function ownedAdvance(propertyId, advanceId) {
  const [row] = await db.select({ advance: advancePayment }).from(advancePayment).innerJoin(tenant, eq15(advancePayment.tenantId, tenant.id)).where(and14(eq15(advancePayment.id, advanceId), eq15(tenant.propertyId, propertyId))).limit(1);
  return row?.advance;
}
router12.get("/", async (req, res) => {
  try {
    const advances = await db.select({ advance: advancePayment, tenantName: tenant.name }).from(advancePayment).innerJoin(tenant, eq15(advancePayment.tenantId, tenant.id)).where(eq15(tenant.propertyId, req.propertyId)).orderBy(desc2(advancePayment.date));
    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch advance payments" });
  }
});
router12.get("/tenant/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    if (!await ownedTenant(req.propertyId, tenantId)) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const advances = await db.select().from(advancePayment).where(eq15(advancePayment.tenantId, tenantId)).orderBy(desc2(advancePayment.date));
    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant advance payments" });
  }
});
router12.post("/", async (req, res) => {
  try {
    const body = createSchema2.parse(req.body);
    if (!await ownedTenant(req.propertyId, body.tenantId)) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const [created] = await db.insert(advancePayment).values({
      tenantId: body.tenantId,
      amount: body.amount,
      date: body.date,
      notes: body.notes
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z11.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record advance payment" });
  }
});
router12.post("/:advanceId/apply", async (req, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    const advanceId = param(req, "advanceId");
    const advance = await ownedAdvance(req.propertyId, advanceId);
    if (!advance) return res.status(404).json({ error: "Advance payment not found" });
    const [targetBill] = await db.select({ bill }).from(bill).innerJoin(tenant, eq15(bill.tenantId, tenant.id)).where(and14(eq15(bill.id, body.billId), eq15(tenant.propertyId, req.propertyId))).limit(1);
    if (!targetBill) return res.status(404).json({ error: "Bill not found" });
    const decision = applyAdvanceToBill({
      advance,
      billBalance: targetBill.bill.balance,
      requestedAmount: body.amount
    });
    if (!decision.ok) {
      const messages = {
        forfeited: "Advance has been forfeited and cannot be applied",
        "nothing-available": "No balance remains on this advance",
        "exceeds-available": "Amount exceeds what remains available on this advance",
        "exceeds-bill-balance": "Amount exceeds the bill's outstanding balance"
      };
      return res.status(409).json({ error: messages[decision.reason] });
    }
    const result = await db.transaction(async (tx) => {
      const [updatedAdvance] = await tx.update(advancePayment).set({
        appliedAmount: decision.newAppliedAmount,
        status: decision.newAdvanceStatus,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq15(advancePayment.id, advanceId)).returning();
      await tx.insert(payment).values({
        billId: body.billId,
        amount: decision.amountApplied,
        paymentDate: /* @__PURE__ */ new Date(),
        method: "advance",
        notes: `Applied from advance payment ${advanceId}`
      });
      return updatedAdvance;
    });
    const billStatus = await syncBillTotals(body.billId, targetBill.bill.totalAmount);
    res.json({
      message: `Applied ${decision.amountApplied} from advance to bill`,
      amountApplied: decision.amountApplied,
      advance: result,
      bill: billStatus
    });
  } catch (error) {
    if (error instanceof z11.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof HttpError) return next(error);
    res.status(500).json({ error: "Failed to apply advance payment" });
  }
});
router12.post("/:advanceId/forfeit", async (req, res) => {
  try {
    const advanceId = param(req, "advanceId");
    const advance = await ownedAdvance(req.propertyId, advanceId);
    if (!advance) return res.status(404).json({ error: "Advance payment not found" });
    if (advance.status === "forfeited") {
      return res.status(409).json({ error: "Advance is already forfeited" });
    }
    const [updated] = await db.update(advancePayment).set({ status: "forfeited", updatedAt: /* @__PURE__ */ new Date() }).where(eq15(advancePayment.id, advanceId)).returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to forfeit advance payment" });
  }
});
var advance_payments_default = router12;

// src/routes/security-deposits.ts
import { Router as Router13 } from "express";
import { z as z12 } from "zod";
import { eq as eq16, and as and15, desc as desc3 } from "drizzle-orm";

// src/lib/security-deposit.ts
function outstandingLiability(deposit) {
  return deposit.amount - deposit.refundAmount;
}
function issueRefund(inputs) {
  if (inputs.deposit.status === "refunded") {
    return { ok: false, reason: "already-refunded" };
  }
  if (inputs.requestedAmount <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }
  const outstanding = outstandingLiability(inputs.deposit);
  if (inputs.requestedAmount > outstanding) {
    return { ok: false, reason: "exceeds-outstanding" };
  }
  const newRefundAmount = inputs.deposit.refundAmount + inputs.requestedAmount;
  return {
    ok: true,
    newRefundAmount,
    newStatus: newRefundAmount >= inputs.deposit.amount ? "refunded" : "partial"
  };
}
function summarizeLiability(deposits) {
  const totalHeld = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalRefunded = deposits.reduce((sum, d) => sum + d.refundAmount, 0);
  return { totalHeld, totalRefunded, netLiability: totalHeld - totalRefunded };
}

// src/routes/security-deposits.ts
var router13 = Router13({ mergeParams: true });
var createSchema3 = z12.object({
  tenantId: z12.string().uuid(),
  amount: z12.number().int().min(1),
  promisedDate: z12.string().transform((str) => new Date(str)).optional(),
  notes: z12.string().optional()
});
var refundSchema = z12.object({
  amount: z12.number().int().min(1),
  date: z12.string().transform((str) => new Date(str)).optional()
});
router13.use(requireAuth, requireOwner, requireProperty);
async function ownedTenant2(propertyId, tenantId) {
  const [t] = await db.select({ id: tenant.id }).from(tenant).where(and15(eq16(tenant.id, tenantId), eq16(tenant.propertyId, propertyId))).limit(1);
  return t;
}
router13.get("/", async (req, res) => {
  try {
    const deposits = await db.select({ deposit: securityDeposit, tenantName: tenant.name }).from(securityDeposit).innerJoin(tenant, eq16(securityDeposit.tenantId, tenant.id)).where(eq16(securityDeposit.propertyId, req.propertyId)).orderBy(desc3(securityDeposit.createdAt));
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security deposits" });
  }
});
router13.get("/liability-report", async (req, res) => {
  try {
    const deposits = await db.select({ amount: securityDeposit.amount, refundAmount: securityDeposit.refundAmount }).from(securityDeposit).where(eq16(securityDeposit.propertyId, req.propertyId));
    res.json(summarizeLiability(deposits));
  } catch (error) {
    res.status(500).json({ error: "Failed to build liability report" });
  }
});
router13.get("/:depositId", async (req, res) => {
  try {
    const [deposit] = await db.select().from(securityDeposit).where(
      and15(
        eq16(securityDeposit.id, param(req, "depositId")),
        eq16(securityDeposit.propertyId, req.propertyId)
      )
    ).limit(1);
    if (!deposit) return res.status(404).json({ error: "Security deposit not found" });
    res.json(deposit);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security deposit" });
  }
});
router13.post("/", async (req, res) => {
  try {
    const body = createSchema3.parse(req.body);
    if (!await ownedTenant2(req.propertyId, body.tenantId)) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const [created] = await db.insert(securityDeposit).values({
      tenantId: body.tenantId,
      propertyId: req.propertyId,
      amount: body.amount,
      promisedDate: body.promisedDate,
      notes: body.notes
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z12.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record security deposit" });
  }
});
router13.post("/:depositId/refund", async (req, res) => {
  try {
    const body = refundSchema.parse(req.body);
    const depositId = param(req, "depositId");
    const [deposit] = await db.select().from(securityDeposit).where(and15(eq16(securityDeposit.id, depositId), eq16(securityDeposit.propertyId, req.propertyId))).limit(1);
    if (!deposit) return res.status(404).json({ error: "Security deposit not found" });
    const decision = issueRefund({ deposit, requestedAmount: body.amount });
    if (!decision.ok) {
      const messages = {
        "already-refunded": "This deposit has already been fully refunded",
        "invalid-amount": "Refund amount must be positive",
        "exceeds-outstanding": "Refund amount exceeds what remains outstanding"
      };
      return res.status(409).json({ error: messages[decision.reason] });
    }
    const [updated] = await db.update(securityDeposit).set({
      refundAmount: decision.newRefundAmount,
      status: decision.newStatus,
      refundDate: body.date ?? /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq16(securityDeposit.id, depositId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z12.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to issue refund" });
  }
});
var security_deposits_default = router13;

// src/routes/expenses.ts
import { Router as Router14 } from "express";
import { z as z13 } from "zod";
import { eq as eq17, and as and16, desc as desc4 } from "drizzle-orm";

// src/lib/expenses.ts
function decideExpense(expense2, decision) {
  if (expense2.status !== "pending") {
    return { ok: false, reason: "not-pending" };
  }
  return { ok: true, newStatus: decision === "approve" ? "approved" : "rejected" };
}
function summarizeExpenses(expenses) {
  const approved = expenses.filter((e) => e.status === "approved");
  const pending = expenses.filter((e) => e.status === "pending");
  const total = approved.reduce((sum, e) => sum + e.amount, 0);
  const pendingTotal = pending.reduce((sum, e) => sum + e.amount, 0);
  const categoryMap = /* @__PURE__ */ new Map();
  for (const e of approved) {
    const existing = categoryMap.get(e.categoryId);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      categoryMap.set(e.categoryId, {
        categoryId: e.categoryId,
        categoryName: e.categoryName,
        total: e.amount,
        count: 1
      });
    }
  }
  const monthMap = /* @__PURE__ */ new Map();
  for (const e of approved) {
    const d = new Date(e.date);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(month);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      monthMap.set(month, { month, total: e.amount, count: 1 });
    }
  }
  return {
    total,
    pendingTotal,
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
    byMonth: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))
  };
}

// src/routes/expenses.ts
function pgErrorCode(error) {
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current;
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return void 0;
}
var router14 = Router14({ mergeParams: true });
var categorySchema = z13.object({ name: z13.string().min(1).max(50) });
var createExpenseSchema = z13.object({
  categoryId: z13.string().uuid(),
  amount: z13.number().int().min(1),
  description: z13.string().min(1).max(200),
  date: z13.string().transform((str) => new Date(str)).optional(),
  notes: z13.string().optional()
});
router14.use(requireAuth, requireOwner, requireProperty);
async function ownedCategory(propertyId, categoryId) {
  const [c] = await db.select({ id: expenseCategory.id }).from(expenseCategory).where(and16(eq17(expenseCategory.id, categoryId), eq17(expenseCategory.propertyId, propertyId))).limit(1);
  return c;
}
router14.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(expenseCategory).where(eq17(expenseCategory.propertyId, req.propertyId)).orderBy(expenseCategory.name);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expense categories" });
  }
});
router14.post("/categories", async (req, res) => {
  try {
    const body = categorySchema.parse(req.body);
    const [created] = await db.insert(expenseCategory).values({ propertyId: req.propertyId, name: body.name }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z13.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (pgErrorCode(error) === "23505") {
      return res.status(409).json({ error: "A category with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create expense category" });
  }
});
router14.delete("/categories/:categoryId", async (req, res) => {
  try {
    const categoryId = param(req, "categoryId");
    if (!await ownedCategory(req.propertyId, categoryId)) {
      return res.status(404).json({ error: "Category not found" });
    }
    await db.delete(expenseCategory).where(eq17(expenseCategory.id, categoryId));
    res.status(204).send();
  } catch (error) {
    if (pgErrorCode(error) === "23001" || pgErrorCode(error) === "23503") {
      return res.status(409).json({ error: "This category has expenses recorded against it" });
    }
    res.status(500).json({ error: "Failed to delete expense category" });
  }
});
router14.get("/", async (req, res) => {
  try {
    const rows = await db.select({ expense, categoryName: expenseCategory.name }).from(expense).innerJoin(expenseCategory, eq17(expense.categoryId, expenseCategory.id)).where(eq17(expense.propertyId, req.propertyId)).orderBy(desc4(expense.date));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});
router14.get("/summary", async (req, res) => {
  try {
    const rows = await db.select({
      categoryId: expense.categoryId,
      categoryName: expenseCategory.name,
      amount: expense.amount,
      status: expense.status,
      date: expense.date
    }).from(expense).innerJoin(expenseCategory, eq17(expense.categoryId, expenseCategory.id)).where(eq17(expense.propertyId, req.propertyId));
    res.json(summarizeExpenses(rows));
  } catch (error) {
    res.status(500).json({ error: "Failed to build expense summary" });
  }
});
router14.post("/", async (req, res) => {
  try {
    const body = createExpenseSchema.parse(req.body);
    if (!await ownedCategory(req.propertyId, body.categoryId)) {
      return res.status(404).json({ error: "Category not found" });
    }
    const [created] = await db.insert(expense).values({
      propertyId: req.propertyId,
      categoryId: body.categoryId,
      amount: body.amount,
      description: body.description,
      date: body.date,
      notes: body.notes
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z13.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record expense" });
  }
});
async function decide(req, res, decision) {
  try {
    const expenseId = param(req, "expenseId");
    const [row] = await db.select().from(expense).where(and16(eq17(expense.id, expenseId), eq17(expense.propertyId, req.propertyId))).limit(1);
    if (!row) return res.status(404).json({ error: "Expense not found" });
    const result = decideExpense(row, decision);
    if (!result.ok) {
      return res.status(409).json({ error: "This expense has already been decided" });
    }
    const [updated] = await db.update(expense).set({
      status: result.newStatus,
      approvedBy: req.user.id,
      approvedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq17(expense.id, expenseId)).returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: `Failed to ${decision} expense` });
  }
}
router14.post("/:expenseId/approve", (req, res) => decide(req, res, "approve"));
router14.post("/:expenseId/reject", (req, res) => decide(req, res, "reject"));
var expenses_default = router14;

// src/routes/dashboard.ts
import { Router as Router15 } from "express";
import { eq as eq18, and as and17, sql as sql7, inArray as inArray6, gte } from "drizzle-orm";

// src/lib/dashboard-analytics.ts
function daysOverdue(dueDate, asOf = /* @__PURE__ */ new Date()) {
  if (!dueDate) return 0;
  const due = startOfDay2(new Date(dueDate));
  const today = startOfDay2(asOf);
  const diff = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1e3));
  return Math.max(0, diff);
}
function startOfDay2(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function agingBucketFor(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
var BUCKET_ORDER = ["current", "0-30", "31-60", "61-90", "90+"];
function summarizeAging(rows) {
  const totals = /* @__PURE__ */ new Map();
  for (const bucketName of BUCKET_ORDER) totals.set(bucketName, { total: 0, count: 0 });
  let total = 0;
  for (const row of rows) {
    const bucketName = agingBucketFor(row.daysOverdue);
    const entry = totals.get(bucketName);
    entry.total += row.balance;
    entry.count += 1;
    total += row.balance;
  }
  return {
    buckets: BUCKET_ORDER.map((bucketName) => ({
      bucket: bucketName,
      ...totals.get(bucketName)
    })),
    total
  };
}
function buildMonthlyTrend(rows, months, asOf = /* @__PURE__ */ new Date()) {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const result = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(month);
    result.push(existing ?? { month, collected: 0, expenses: 0 });
  }
  return result;
}

// src/routes/dashboard.ts
var router15 = Router15();
function currentMonth() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
}
async function occupancyFor(propertyIds) {
  if (propertyIds.length === 0) {
    return { totalBeds: 0, occupiedBeds: 0, occupancyRate: 0 };
  }
  const { totalBeds, occupiedBeds } = aggregate(
    await db.select({
      totalBeds: sql7`count(*)::int`,
      occupiedBeds: sql7`count(*) filter (where ${bed.status} = 'occupied')::int`
    }).from(bed).innerJoin(room, eq18(bed.roomId, room.id)).where(inArray6(room.propertyId, propertyIds)),
    { totalBeds: 0, occupiedBeds: 0 }
  );
  return {
    totalBeds,
    occupiedBeds,
    occupancyRate: totalBeds > 0 ? Math.round(occupiedBeds / totalBeds * 100) : 0
  };
}
router15.get("/owner", requireAuth, requireOwner, async (req, res) => {
  try {
    const properties = await db.select().from(property).where(eq18(property.ownerId, req.ownerId));
    const propertyIds = properties.map((p) => p.id);
    if (propertyIds.length === 0) {
      return res.json({
        totalProperties: 0,
        totalRooms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        totalTenants: 0,
        occupancyRate: 0,
        monthlyCollection: 0,
        pendingRent: 0,
        overdueRent: 0
      });
    }
    const { roomCount } = aggregate(
      await db.select({ roomCount: sql7`count(*)::int` }).from(room).where(inArray6(room.propertyId, propertyIds)),
      { roomCount: 0 }
    );
    const occupancy = await occupancyFor(propertyIds);
    const { activeTenants } = aggregate(
      await db.select({ activeTenants: sql7`count(*)::int` }).from(tenant).where(
        and17(inArray6(tenant.propertyId, propertyIds), eq18(tenant.status, "active"))
      ),
      { activeTenants: 0 }
    );
    const month = currentMonth();
    const { totalBilled } = aggregate(
      await db.select({ totalBilled: sql7`coalesce(sum(${bill.totalAmount}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(
        and17(inArray6(tenant.propertyId, propertyIds), eq18(bill.billMonth, month))
      ),
      { totalBilled: 0 }
    );
    const { totalPaid } = aggregate(
      await db.select({ totalPaid: sql7`coalesce(sum(${bill.paidAmount}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(
        and17(inArray6(tenant.propertyId, propertyIds), eq18(bill.billMonth, month))
      ),
      { totalPaid: 0 }
    );
    const { overdueAmount } = aggregate(
      await db.select({ overdueAmount: sql7`coalesce(sum(${bill.balance}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(
        and17(inArray6(tenant.propertyId, propertyIds), eq18(bill.status, "overdue"))
      ),
      { overdueAmount: 0 }
    );
    res.json({
      totalProperties: properties.length,
      totalRooms: roomCount,
      totalBeds: occupancy.totalBeds,
      occupiedBeds: occupancy.occupiedBeds,
      totalTenants: activeTenants,
      occupancyRate: occupancy.occupancyRate,
      monthlyCollection: totalPaid,
      pendingRent: totalBilled - totalPaid,
      overdueRent: overdueAmount
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});
router15.get(
  "/property/:propertyId",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const prop = req.property;
      const { roomCount } = aggregate(
        await db.select({ roomCount: sql7`count(*)::int` }).from(room).where(eq18(room.propertyId, prop.id)),
        { roomCount: 0 }
      );
      const { activeTenants } = aggregate(
        await db.select({ activeTenants: sql7`count(*)::int` }).from(tenant).where(and17(eq18(tenant.propertyId, prop.id), eq18(tenant.status, "active"))),
        { activeTenants: 0 }
      );
      const occupancy = await occupancyFor([prop.id]);
      const month = currentMonth();
      const { totalBilled } = aggregate(
        await db.select({ totalBilled: sql7`coalesce(sum(${bill.totalAmount}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(and17(eq18(tenant.propertyId, prop.id), eq18(bill.billMonth, month))),
        { totalBilled: 0 }
      );
      const { totalPaid } = aggregate(
        await db.select({ totalPaid: sql7`coalesce(sum(${bill.paidAmount}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(and17(eq18(tenant.propertyId, prop.id), eq18(bill.billMonth, month))),
        { totalPaid: 0 }
      );
      const { overdueAmount } = aggregate(
        await db.select({ overdueAmount: sql7`coalesce(sum(${bill.balance}), 0)::int` }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(and17(eq18(tenant.propertyId, prop.id), eq18(bill.status, "overdue"))),
        { overdueAmount: 0 }
      );
      res.json({
        property: prop,
        totalRooms: roomCount,
        totalBeds: occupancy.totalBeds,
        occupiedBeds: occupancy.occupiedBeds,
        activeTenants,
        occupancyRate: occupancy.occupancyRate,
        monthlyBilled: totalBilled,
        monthlyCollected: totalPaid,
        monthlyPending: totalBilled - totalPaid,
        overdueRent: overdueAmount
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property dashboard" });
    }
  }
);
router15.get(
  "/property/:propertyId/monthly-trend",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const propertyId = req.propertyId;
      const months = 6;
      const since = /* @__PURE__ */ new Date();
      since.setMonth(since.getMonth() - (months - 1));
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
      const collectedRows = await db.select({
        month: sql7`to_char(${payment.paymentDate}, 'YYYY-MM')`,
        collected: sql7`coalesce(sum(${payment.amount}), 0)::int`
      }).from(payment).innerJoin(bill, eq18(payment.billId, bill.id)).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(and17(eq18(tenant.propertyId, propertyId), gte(payment.paymentDate, since))).groupBy(sql7`to_char(${payment.paymentDate}, 'YYYY-MM')`);
      const expenseRows = await db.select({
        month: sql7`to_char(${expense.date}, 'YYYY-MM')`,
        expenses: sql7`coalesce(sum(${expense.amount}), 0)::int`
      }).from(expense).where(
        and17(
          eq18(expense.propertyId, propertyId),
          eq18(expense.status, "approved"),
          gte(expense.date, since)
        )
      ).groupBy(sql7`to_char(${expense.date}, 'YYYY-MM')`);
      const collectedByMonth = new Map(collectedRows.map((r) => [r.month, r.collected]));
      const expensesByMonth = new Map(expenseRows.map((r) => [r.month, r.expenses]));
      const allMonths = /* @__PURE__ */ new Set([...collectedByMonth.keys(), ...expensesByMonth.keys()]);
      const merged = Array.from(allMonths).map((month) => ({
        month,
        collected: collectedByMonth.get(month) ?? 0,
        expenses: expensesByMonth.get(month) ?? 0
      }));
      res.json(buildMonthlyTrend(merged, months));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monthly trend" });
    }
  }
);
router15.get(
  "/property/:propertyId/due-rent",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const rows = await db.select({
        tenantId: tenant.id,
        tenantName: tenant.name,
        roomNumber: room.number,
        amountDue: bill.balance,
        dueDate: bill.dueDate
      }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).leftJoin(room, eq18(tenant.roomId, room.id)).where(and17(eq18(tenant.propertyId, req.propertyId), sql7`${bill.balance} > 0`)).orderBy(bill.dueDate);
      const withOverdue = rows.map((r) => ({
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        roomNumber: r.roomNumber,
        amountDue: r.amountDue,
        daysOverdue: daysOverdue(r.dueDate)
      })).sort((a, b) => b.daysOverdue - a.daysOverdue);
      res.json(withOverdue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch due rent" });
    }
  }
);
router15.get(
  "/property/:propertyId/outstanding-payment",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const rows = await db.select({
        tenantId: tenant.id,
        balance: bill.balance,
        dueDate: bill.dueDate
      }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).where(and17(eq18(tenant.propertyId, req.propertyId), sql7`${bill.balance} > 0`));
      const agingRows = rows.map((r) => ({
        tenantId: r.tenantId,
        balance: r.balance,
        daysOverdue: daysOverdue(r.dueDate)
      }));
      res.json(summarizeAging(agingRows));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch outstanding payment breakdown" });
    }
  }
);
router15.get(
  "/property/:propertyId/outstanding-payment/details",
  requireAuth,
  requireOwner,
  requireProperty,
  async (req, res) => {
    try {
      const rows = await db.select({
        tenantId: tenant.id,
        tenantName: tenant.name,
        roomNumber: room.number,
        billId: bill.id,
        billMonth: bill.billMonth,
        balance: bill.balance,
        dueDate: bill.dueDate
      }).from(bill).innerJoin(tenant, eq18(bill.tenantId, tenant.id)).leftJoin(room, eq18(tenant.roomId, room.id)).where(and17(eq18(tenant.propertyId, req.propertyId), sql7`${bill.balance} > 0`));
      const buckets = {
        current: [],
        "0-30": [],
        "31-60": [],
        "61-90": [],
        "90+": []
      };
      for (const row of rows) {
        const days = daysOverdue(row.dueDate);
        let bucket;
        if (days <= 0) bucket = "current";
        else if (days <= 30) bucket = "0-30";
        else if (days <= 60) bucket = "31-60";
        else if (days <= 90) bucket = "61-90";
        else bucket = "90+";
        const bucketList = buckets[bucket];
        if (bucketList) {
          bucketList.push(row);
        }
      }
      res.json(buckets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch outstanding payment details" });
    }
  }
);
var dashboard_default = router15;

// src/routes/reminders.ts
import { Router as Router16 } from "express";
import { z as z14 } from "zod";
import { eq as eq19, and as and18, sql as sql8 } from "drizzle-orm";
var router16 = Router16({ mergeParams: true });
var sendReminderSchema = z14.object({
  billIds: z14.array(z14.string().uuid()),
  channel: z14.enum(["email", "whatsapp", "both"]).default("email")
});
router16.use(requireAuth, requireOwner, requireProperty);
router16.post("/send", async (req, res) => {
  try {
    const { billIds, channel } = sendReminderSchema.parse(req.body);
    const billsToSend = await db.select({
      bill,
      tenant
    }).from(bill).innerJoin(tenant, eq19(bill.tenantId, tenant.id)).where(and18(
      sql8`${bill.id} = ANY(${billIds})`,
      eq19(tenant.propertyId, req.propertyId)
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
    if (error instanceof z14.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to send reminders" });
  }
});
var reminders_default = router16;

// src/routes/public.ts
import { Router as Router17 } from "express";
import { z as z15 } from "zod";
import { eq as eq20, and as and19 } from "drizzle-orm";

// src/lib/r2-storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
var R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
var R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
var R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
var R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
var R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
var s3Client = null;
function getClient() {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME");
    }
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
  }
  return s3Client;
}
async function uploadToR2(folder, fileName, buffer, contentType) {
  const ext = fileName.split(".").pop() || "bin";
  const key = `${folder}/${randomUUID()}.${ext}`;
  const client2 = getClient();
  await client2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );
  const url = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
  return { key, url, size: buffer.length };
}
async function deleteFromR2(key) {
  const client2 = getClient();
  await client2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    })
  );
}
function isR2Configured() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

// src/routes/public.ts
var router17 = Router17();
var signupSchema = z15.object({
  name: z15.string().min(1).max(100),
  phone: z15.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  email: z15.string().email().optional(),
  alternatePhone: z15.string().regex(/^\d{10}$/, "Must be 10 digits").optional().or(z15.literal("")),
  dateOfBirth: z15.string().optional(),
  gender: z15.enum(["male", "female", "other"]).optional(),
  occupation: z15.string().max(100).optional(),
  aadhaarNumber: z15.string().regex(/^\d{12}$/, "Must be 12 digits").optional().or(z15.literal("")),
  panNumber: z15.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format").optional().or(z15.literal("")),
  permanentAddress: z15.string().optional(),
  permanentAddressCity: z15.string().optional(),
  permanentAddressState: z15.string().optional(),
  permanentAddressPincode: z15.string().regex(/^\d{6}$/, "Must be 6 digits").optional().or(z15.literal("")),
  roomId: z15.string().uuid(),
  documents: z15.array(z15.object({
    type: z15.enum(["aadhaar", "pan", "passport", "driving_license", "other"]),
    fileName: z15.string().min(1).max(255),
    fileBase64: z15.string().min(1),
    contentType: z15.string().min(1).max(100)
  })).min(1, "At least one ID proof document is required").max(5)
});
var complaintSchema = z15.object({
  subject: z15.string().min(1).max(200),
  description: z15.string().min(1).max(1e3),
  roomId: z15.string().uuid(),
  tenantId: z15.string().uuid().optional(),
  category: z15.enum(["plumbing", "electrical", "cleaning", "maintenance", "security", "other"]).optional(),
  priority: z15.enum(["low", "medium", "high", "urgent"]).optional()
});
router17.get("/signup/:token", async (req, res) => {
  try {
    const [prop] = await db.select().from(property).where(eq20(property.signupToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid signup link" });
    const rooms = await db.select({
      id: room.id,
      number: room.number,
      type: room.type
    }).from(room).where(eq20(room.propertyId, prop.id));
    res.json({
      propertyName: prop.name,
      rooms
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch signup data" });
  }
});
router17.post("/signup/:token", async (req, res) => {
  try {
    const body = signupSchema.parse(req.body);
    const [prop] = await db.select().from(property).where(eq20(property.signupToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid signup link" });
    const [r] = await db.select().from(room).where(and19(eq20(room.id, body.roomId), eq20(room.propertyId, prop.id))).limit(1);
    if (!r) return res.status(404).json({ error: "Room not found" });
    const [existing] = await db.select().from(tenant).where(and19(eq20(tenant.phone, body.phone), eq20(tenant.propertyId, prop.id))).limit(1);
    if (existing) {
      return res.status(409).json({ error: "Phone already registered" });
    }
    if (!isR2Configured()) {
      return res.status(503).json({ error: "Document uploads are temporarily unavailable" });
    }
    const [newTenant] = await db.insert(tenant).values({
      propertyId: prop.id,
      name: body.name,
      phone: body.phone,
      email: body.email,
      alternatePhone: body.alternatePhone || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender || null,
      occupation: body.occupation || null,
      aadhaarNumber: body.aadhaarNumber || null,
      panNumber: body.panNumber || null,
      permanentAddress: body.permanentAddress || null,
      permanentAddressCity: body.permanentAddressCity || null,
      permanentAddressState: body.permanentAddressState || null,
      permanentAddressPincode: body.permanentAddressPincode || null,
      requestedRoomId: body.roomId,
      joiningDate: /* @__PURE__ */ new Date(),
      status: "pending"
    }).returning();
    if (!newTenant) {
      return res.status(500).json({ error: "Failed to process signup" });
    }
    for (const document of body.documents) {
      const buffer = Buffer.from(document.fileBase64, "base64");
      const uploaded = await uploadToR2(
        `kyc/${newTenant.id}`,
        document.fileName,
        buffer,
        document.contentType
      );
      await db.insert(tenantDocument).values({
        tenantId: newTenant.id,
        type: document.type,
        fileName: document.fileName,
        fileUrl: uploaded.url,
        fileSize: uploaded.size
      });
    }
    res.status(201).json({
      message: "Signup received. The owner will review and approve it shortly.",
      tenant: newTenant
    });
  } catch (error) {
    if (error instanceof z15.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to process signup" });
  }
});
router17.get("/complaint/:token", async (req, res) => {
  try {
    const [prop] = await db.select().from(property).where(eq20(property.complaintToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });
    const roomsWithTenants = await db.select({
      roomId: room.id,
      roomNumber: room.number,
      tenantId: tenant.id,
      tenantName: tenant.name
    }).from(room).leftJoin(tenant, and19(
      eq20(tenant.roomId, room.id),
      eq20(tenant.status, "active")
    )).where(eq20(room.propertyId, prop.id)).orderBy(room.number);
    const rooms = roomsWithTenants.reduce((acc, row) => {
      const existing = acc.find((r) => r.roomId === row.roomId);
      if (existing) {
        if (row.tenantId) {
          existing.tenants.push({
            id: row.tenantId,
            name: row.tenantName
          });
        }
      } else {
        acc.push({
          id: row.roomId,
          number: row.roomNumber,
          tenants: row.tenantId ? [{
            id: row.tenantId,
            name: row.tenantName
          }] : []
        });
      }
      return acc;
    }, []);
    res.json({ propertyName: prop.name, rooms });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaint data" });
  }
});
router17.post("/complaint/:token", async (req, res) => {
  try {
    const body = complaintSchema.parse(req.body);
    const [prop] = await db.select().from(property).where(eq20(property.complaintToken, req.params.token)).limit(1);
    if (!prop) return res.status(404).json({ error: "Invalid complaint link" });
    const [selectedRoom] = await db.select({ id: room.id, number: room.number }).from(room).where(and19(eq20(room.id, body.roomId), eq20(room.propertyId, prop.id))).limit(1);
    if (!selectedRoom) return res.status(404).json({ error: "Room not found" });
    if (body.tenantId) {
      const [selectedTenant] = await db.select({ id: tenant.id }).from(tenant).where(and19(
        eq20(tenant.id, body.tenantId),
        eq20(tenant.propertyId, prop.id),
        eq20(tenant.roomId, selectedRoom.id),
        eq20(tenant.status, "active")
      )).limit(1);
      if (!selectedTenant) return res.status(400).json({ error: "Tenant does not belong to this room" });
    }
    const [newComplaint] = await db.insert(complaint).values({
      propertyId: prop.id,
      tenantId: body.tenantId || null,
      subject: body.subject,
      description: body.description,
      roomNumber: selectedRoom.number,
      category: body.category || "other",
      priority: body.priority || "medium",
      status: "open"
    }).returning();
    res.status(201).json({ message: "Complaint submitted", complaint: newComplaint });
  } catch (error) {
    if (error instanceof z15.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});
router17.get("/onboarding/:token", async (req, res) => {
  try {
    const [t] = await db.select({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      roomId: tenant.roomId,
      bedId: tenant.bedId,
      joiningDate: tenant.joiningDate
    }).from(tenant).where(eq20(tenant.onboardingToken, req.params.token)).limit(1);
    if (!t) return res.status(404).json({ error: "Invalid onboarding link" });
    let roomNumber = null;
    if (t.roomId) {
      const [r] = await db.select({ number: room.number }).from(room).where(eq20(room.id, t.roomId)).limit(1);
      roomNumber = r?.number ?? null;
    }
    res.json({
      name: t.name,
      status: t.status,
      roomNumber,
      joiningDate: t.joiningDate
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch onboarding status" });
  }
});
var public_default = router17;

// src/routes/admin.ts
import { Router as Router18 } from "express";
import { eq as eq21, sql as sql9 } from "drizzle-orm";
var router18 = Router18();
async function requireSuperAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const [admin] = await db.select({ id: platformAdmin.id }).from(platformAdmin).where(eq21(platformAdmin.userId, req.user.id)).limit(1);
  if (!admin) {
    return res.status(403).json({ error: "Platform admin access required" });
  }
  next();
}
router18.get("/overview", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { userCount } = aggregate(
      await db.select({ userCount: sql9`count(*)::int` }).from(user),
      { userCount: 0 }
    );
    const { ownerCount } = aggregate(
      await db.select({ ownerCount: sql9`count(*)::int` }).from(ownerProfile),
      { ownerCount: 0 }
    );
    const { propertyCount } = aggregate(
      await db.select({ propertyCount: sql9`count(*)::int` }).from(property),
      { propertyCount: 0 }
    );
    const { tenantCount } = aggregate(
      await db.select({ tenantCount: sql9`count(*)::int` }).from(tenant).where(eq21(tenant.status, "active")),
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
router18.get("/owners", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const owners = await db.select({
      owner: ownerProfile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }).from(ownerProfile).leftJoin(user, eq21(ownerProfile.userId, user.id));
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});
router18.get("/owners/:ownerId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const ownerId = param(req, "ownerId");
    const [owner] = await db.select({
      owner: ownerProfile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }).from(ownerProfile).leftJoin(user, eq21(ownerProfile.userId, user.id)).where(eq21(ownerProfile.id, ownerId)).limit(1);
    if (!owner) return res.status(404).json({ error: "Owner not found" });
    const properties = await db.select().from(property).where(eq21(property.ownerId, ownerId));
    res.json({ ...owner, properties });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owner" });
  }
});
var admin_default = router18;

// src/routes/emergency-contacts.ts
import { Router as Router19 } from "express";
import { z as z16 } from "zod";
import { eq as eq22, and as and20 } from "drizzle-orm";
var router19 = Router19({ mergeParams: true });
var createSchema4 = z16.object({
  name: z16.string().min(1).max(100),
  phone: z16.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  relation: z16.string().min(1).max(50)
});
router19.use(requireAuth, requireOwner, requireProperty);
router19.get("/tenant/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(and20(eq22(tenant.id, tenantId), eq22(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const contacts = await db.select().from(emergencyContact).where(eq22(emergencyContact.tenantId, tenantId));
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch emergency contacts" });
  }
});
router19.post("/tenant/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const body = createSchema4.parse(req.body);
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(and20(eq22(tenant.id, tenantId), eq22(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const [created] = await db.insert(emergencyContact).values({ ...body, tenantId }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z16.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add emergency contact" });
  }
});
router19.delete("/:contactId", async (req, res) => {
  try {
    const contactId = param(req, "contactId");
    const [deleted] = await db.delete(emergencyContact).where(
      and20(
        eq22(emergencyContact.id, contactId),
        eq22(
          emergencyContact.tenantId,
          // Subquery: contact's tenant must belong to this property
          db.select({ id: tenant.id }).from(tenant).where(
            and20(
              eq22(tenant.id, emergencyContact.tenantId),
              eq22(tenant.propertyId, req.propertyId)
            )
          ).limit(1)
        )
      )
    ).returning();
    if (!deleted) return res.status(404).json({ error: "Contact not found" });
    res.json({ message: "Contact deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete emergency contact" });
  }
});
var emergency_contacts_default = router19;

// src/routes/bed-bookings.ts
import { Router as Router20 } from "express";
import { z as z17 } from "zod";
import { eq as eq23, and as and21 } from "drizzle-orm";
var router20 = Router20({ mergeParams: true });
var createSchema5 = z17.object({
  bedId: z17.string().uuid(),
  tenantName: z17.string().min(1).max(100),
  tenantPhone: z17.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  notes: z17.string().optional(),
  expiryDays: z17.number().min(1).max(30).optional()
});
router20.use(requireAuth, requireOwner, requireProperty);
async function verifyBookingOwnership(bookingId, propertyId) {
  const [row] = await db.select({ booking: bedBooking, bedId: bed.id, roomId: bed.roomId }).from(bedBooking).innerJoin(bed, eq23(bedBooking.bedId, bed.id)).innerJoin(room, eq23(bed.roomId, room.id)).where(and21(eq23(bedBooking.id, bookingId), eq23(room.propertyId, propertyId))).limit(1);
  return row;
}
router20.get("/", async (req, res) => {
  try {
    const bookings = await db.select({
      booking: bedBooking,
      bedNumber: bed.number,
      roomNumber: room.number
    }).from(bedBooking).innerJoin(bed, eq23(bedBooking.bedId, bed.id)).innerJoin(room, eq23(bed.roomId, room.id)).where(eq23(room.propertyId, req.propertyId));
    res.json(
      bookings.map((row) => ({
        ...row.booking,
        bedNumber: row.bedNumber,
        roomNumber: row.roomNumber
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});
router20.post("/", async (req, res) => {
  try {
    const body = createSchema5.parse(req.body);
    const [b] = await db.select({ id: bed.id, status: bed.status }).from(bed).innerJoin(room, eq23(bed.roomId, room.id)).where(and21(eq23(bed.id, body.bedId), eq23(room.propertyId, req.propertyId))).limit(1);
    if (!b) return res.status(404).json({ error: "Bed not found" });
    if (b.status !== "vacant") return res.status(409).json({ error: "Bed is not vacant" });
    const expiryDate = body.expiryDays ? new Date(Date.now() + body.expiryDays * 24 * 60 * 60 * 1e3) : null;
    const [created] = await db.insert(bedBooking).values({
      bedId: body.bedId,
      tenantName: body.tenantName,
      tenantPhone: body.tenantPhone,
      notes: body.notes,
      expiryDate
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z17.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create booking" });
  }
});
router20.post("/:bookingId/cancel", async (req, res) => {
  try {
    const bookingId = param(req, "bookingId");
    const row = await verifyBookingOwnership(bookingId, req.propertyId);
    if (!row) return res.status(404).json({ error: "Booking not found" });
    const [updated] = await db.update(bedBooking).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq23(bedBooking.id, bookingId)).returning();
    res.json({ message: "Booking cancelled", booking: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});
router20.put("/:bookingId", async (req, res) => {
  try {
    const bookingId = param(req, "bookingId");
    const body = z17.object({
      tenantName: z17.string().min(1).max(100).optional(),
      tenantPhone: z17.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number").optional(),
      notes: z17.string().optional(),
      expiryDays: z17.number().min(1).max(30).optional()
    }).parse(req.body);
    const row = await verifyBookingOwnership(bookingId, req.propertyId);
    if (!row) return res.status(404).json({ error: "Booking not found" });
    const updateData = { updatedAt: /* @__PURE__ */ new Date() };
    if (body.tenantName) updateData.tenantName = body.tenantName;
    if (body.tenantPhone) updateData.tenantPhone = body.tenantPhone;
    if (body.notes !== void 0) updateData.notes = body.notes;
    if (body.expiryDays) {
      updateData.expiryDate = new Date(Date.now() + body.expiryDays * 24 * 60 * 60 * 1e3);
    }
    const [updated] = await db.update(bedBooking).set(updateData).where(eq23(bedBooking.id, bookingId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z17.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update booking" });
  }
});
router20.delete("/:bookingId", async (req, res) => {
  try {
    const bookingId = param(req, "bookingId");
    const row = await verifyBookingOwnership(bookingId, req.propertyId);
    if (!row) return res.status(404).json({ error: "Booking not found" });
    await db.transaction(async (tx) => {
      await tx.update(bed).set({ status: "vacant", updatedAt: /* @__PURE__ */ new Date() }).where(eq23(bed.id, row.bedId));
      await tx.delete(bedBooking).where(eq23(bedBooking.id, bookingId));
    });
    res.json({ message: "Booking deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete booking" });
  }
});
router20.post("/:bookingId/convert", async (req, res) => {
  try {
    const bookingId = param(req, "bookingId");
    const row = await verifyBookingOwnership(bookingId, req.propertyId);
    if (!row) return res.status(404).json({ error: "Booking not found" });
    const booking = row.booking;
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return res.status(409).json({ error: "Booking cannot be converted" });
    }
    const newTenant = await db.transaction(async (tx) => {
      const [t] = await tx.insert(tenant).values({
        propertyId: req.propertyId,
        name: booking.tenantName,
        phone: booking.tenantPhone,
        status: "active",
        bedId: row.bedId,
        roomId: row.roomId,
        joiningDate: /* @__PURE__ */ new Date()
      }).returning();
      await tx.update(bed).set({ status: "occupied", updatedAt: /* @__PURE__ */ new Date() }).where(eq23(bed.id, row.bedId));
      await tx.update(bedBooking).set({ status: "converted", updatedAt: /* @__PURE__ */ new Date() }).where(eq23(bedBooking.id, bookingId));
      return t;
    });
    res.status(201).json({
      message: "Booking converted to tenant",
      tenant: newTenant
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to convert booking" });
  }
});
var bed_bookings_default = router20;

// src/routes/staff.ts
import { Router as Router21 } from "express";
import { z as z18 } from "zod";
import { eq as eq24, and as and22 } from "drizzle-orm";
var router21 = Router21({ mergeParams: true });
var createSchema6 = z18.object({
  name: z18.string().min(1).max(100),
  phone: z18.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  role: z18.enum(["warden", "manager", "accountant", "cleaner"]).default("warden")
});
var updateSchema2 = createSchema6.partial().extend({
  isActive: z18.boolean().optional()
});
router21.use(requireAuth, requireOwner, requireProperty);
router21.get("/", async (req, res) => {
  try {
    const staffList = await db.select().from(staff).where(eq24(staff.propertyId, req.propertyId));
    res.json(staffList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});
router21.post("/", async (req, res) => {
  try {
    const body = createSchema6.parse(req.body);
    const [created] = await db.insert(staff).values({ ...body, propertyId: req.propertyId }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z18.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add staff" });
  }
});
router21.put("/:staffId", async (req, res) => {
  try {
    const staffId = param(req, "staffId");
    const body = updateSchema2.parse(req.body);
    const [updated] = await db.update(staff).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(and22(eq24(staff.id, staffId), eq24(staff.propertyId, req.propertyId))).returning();
    if (!updated) return res.status(404).json({ error: "Staff not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z18.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update staff" });
  }
});
router21.delete("/:staffId", async (req, res) => {
  try {
    const staffId = param(req, "staffId");
    const [deleted] = await db.delete(staff).where(and22(eq24(staff.id, staffId), eq24(staff.propertyId, req.propertyId))).returning();
    if (!deleted) return res.status(404).json({ error: "Staff not found" });
    res.json({ message: "Staff deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
});
var staff_default = router21;

// src/routes/exports.ts
import { Router as Router22 } from "express";
import { eq as eq25 } from "drizzle-orm";
var router22 = Router22({ mergeParams: true });
router22.use(requireAuth, requireOwner, requireProperty);
function toCsv(headers, rows) {
  const escape = (v) => {
    if (v === null || v === void 0) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}
router22.get("/tenants", async (req, res) => {
  try {
    const tenants = await db.select({
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      status: tenant.status,
      roomNumber: room.number,
      bedNumber: bed.number,
      joiningDate: tenant.joiningDate
    }).from(tenant).leftJoin(room, eq25(tenant.roomId, room.id)).leftJoin(bed, eq25(tenant.bedId, bed.id)).where(eq25(tenant.propertyId, req.propertyId));
    const csv = toCsv(
      ["Name", "Phone", "Email", "Status", "Room", "Bed", "Joining Date"],
      tenants.map((t) => [
        t.name,
        t.phone,
        t.email ?? "",
        t.status,
        t.roomNumber ?? "",
        t.bedNumber ?? "",
        t.joiningDate ? new Date(t.joiningDate).toISOString().split("T")[0] : ""
      ])
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tenants.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export tenants" });
  }
});
router22.get("/expenses", async (req, res) => {
  try {
    const expenses = await db.select({
      date: expense.date,
      amount: expense.amount,
      description: expense.description,
      status: expense.status
    }).from(expense).where(eq25(expense.propertyId, req.propertyId));
    const csv = toCsv(
      ["Date", "Amount", "Description", "Status"],
      expenses.map((e) => [
        e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        e.amount,
        e.description,
        e.status
      ])
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=expenses.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export expenses" });
  }
});
var exports_default = router22;

// src/routes/amenities.ts
import { Router as Router23 } from "express";
import { z as z19 } from "zod";
import { eq as eq26, and as and23 } from "drizzle-orm";
var router23 = Router23({ mergeParams: true });
var createSchema7 = z19.object({
  name: z19.string().min(1).max(100),
  description: z19.string().optional()
});
router23.use(requireAuth, requireOwner, requireProperty);
router23.get("/", async (req, res) => {
  try {
    const amenities = await db.select().from(propertyAmenity).where(eq26(propertyAmenity.propertyId, req.propertyId));
    res.json(amenities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch amenities" });
  }
});
router23.post("/", async (req, res) => {
  try {
    const body = createSchema7.parse(req.body);
    const [created] = await db.insert(propertyAmenity).values({ ...body, propertyId: req.propertyId }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z19.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add amenity" });
  }
});
router23.put("/:amenityId", async (req, res) => {
  try {
    const amenityId = param(req, "amenityId");
    const body = createSchema7.partial().parse(req.body);
    const [updated] = await db.update(propertyAmenity).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(and23(eq26(propertyAmenity.id, amenityId), eq26(propertyAmenity.propertyId, req.propertyId))).returning();
    if (!updated) return res.status(404).json({ error: "Amenity not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z19.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update amenity" });
  }
});
router23.delete("/:amenityId", async (req, res) => {
  try {
    const amenityId = param(req, "amenityId");
    const [deleted] = await db.delete(propertyAmenity).where(and23(eq26(propertyAmenity.id, amenityId), eq26(propertyAmenity.propertyId, req.propertyId))).returning();
    if (!deleted) return res.status(404).json({ error: "Amenity not found" });
    res.json({ message: "Amenity deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete amenity" });
  }
});
var amenities_default = router23;

// src/routes/billing-policy.ts
import { Router as Router24 } from "express";
import { z as z20 } from "zod";
import { eq as eq27 } from "drizzle-orm";
var router24 = Router24({ mergeParams: true });
var updateSchema3 = z20.object({
  advanceHandlingMode: z20.enum(["manual", "auto_adjust"]).optional(),
  bookingExpiryDays: z20.number().min(1).max(30).optional(),
  autoAllocatePayments: z20.boolean().optional()
});
router24.use(requireAuth, requireOwner, requireProperty);
router24.get("/", async (req, res) => {
  try {
    const [policy] = await db.select().from(billingPolicy).where(eq27(billingPolicy.propertyId, req.propertyId)).limit(1);
    if (!policy) {
      const [created] = await db.insert(billingPolicy).values({ propertyId: req.propertyId }).returning();
      return res.json(created);
    }
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch billing policy" });
  }
});
router24.put("/", async (req, res) => {
  try {
    const body = updateSchema3.parse(req.body);
    const [existing] = await db.select({ id: billingPolicy.id }).from(billingPolicy).where(eq27(billingPolicy.propertyId, req.propertyId)).limit(1);
    if (!existing) {
      const [created] = await db.insert(billingPolicy).values({ ...body, propertyId: req.propertyId }).returning();
      return res.json(created);
    }
    const [updated] = await db.update(billingPolicy).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(eq27(billingPolicy.propertyId, req.propertyId)).returning();
    res.json(updated);
  } catch (error) {
    if (error instanceof z20.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update billing policy" });
  }
});
var billing_policy_default = router24;

// src/routes/notification-preferences.ts
import { Router as Router25 } from "express";
import { z as z21 } from "zod";
import { eq as eq28, and as and24 } from "drizzle-orm";
var router25 = Router25({ mergeParams: true });
var createSchema8 = z21.object({
  eventType: z21.enum([
    "rent_due",
    "rent_overdue",
    "payment_received",
    "tenant_checkin",
    "tenant_checkout",
    "complaint_created",
    "complaint_resolved"
  ]),
  inApp: z21.boolean().default(true),
  email: z21.boolean().default(true),
  whatsapp: z21.boolean().default(false)
});
var updateSchema4 = z21.object({
  inApp: z21.boolean().optional(),
  email: z21.boolean().optional(),
  whatsapp: z21.boolean().optional()
});
router25.use(requireAuth, requireOwner, requireProperty);
router25.get("/", async (req, res) => {
  try {
    const preferences = await db.select().from(notificationPreference).where(eq28(notificationPreference.propertyId, req.propertyId));
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});
router25.post("/", async (req, res) => {
  try {
    const body = createSchema8.parse(req.body);
    const [existing] = await db.select({ id: notificationPreference.id }).from(notificationPreference).where(
      and24(
        eq28(notificationPreference.propertyId, req.propertyId),
        eq28(notificationPreference.eventType, body.eventType)
      )
    ).limit(1);
    if (existing) {
      const [updated] = await db.update(notificationPreference).set({ ...body, updatedAt: /* @__PURE__ */ new Date() }).where(eq28(notificationPreference.id, existing.id)).returning();
      return res.json(updated);
    }
    const [created] = await db.insert(notificationPreference).values({ ...body, propertyId: req.propertyId }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z21.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to set notification preference" });
  }
});
router25.delete("/:preferenceId", async (req, res) => {
  try {
    const preferenceId = param(req, "preferenceId");
    const [deleted] = await db.delete(notificationPreference).where(
      and24(
        eq28(notificationPreference.id, preferenceId),
        eq28(notificationPreference.propertyId, req.propertyId)
      )
    ).returning();
    if (!deleted) return res.status(404).json({ error: "Preference not found" });
    res.json({ message: "Preference deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete preference" });
  }
});
var notification_preferences_default = router25;

// src/routes/notifications.ts
import { Router as Router26 } from "express";
import { eq as eq29, and as and25, desc as desc5, sql as sql10, inArray as inArray7 } from "drizzle-orm";
var router26 = Router26({ mergeParams: true });
router26.use(requireAuth, requireOwner);
async function getOwnerPropertyIds(ownerId) {
  const props = await db.select({ id: property.id }).from(property).where(eq29(property.ownerId, ownerId));
  return props.map((p) => p.id);
}
function buildOwnerScopedWhere(ownerPropertyIds, filterPropertyId) {
  if (ownerPropertyIds.length === 0) return void 0;
  if (filterPropertyId) {
    if (!ownerPropertyIds.includes(filterPropertyId)) {
      return void 0;
    }
    return eq29(notification.propertyId, filterPropertyId);
  }
  return inArray7(notification.propertyId, ownerPropertyIds);
}
router26.get("/", async (req, res) => {
  try {
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId);
    const propertyId = req.query.propertyId;
    const where = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
    if (!where) return res.json([]);
    const rows = await db.select().from(notification).where(where).orderBy(desc5(notification.createdAt)).limit(50);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});
router26.get("/unread-count", async (req, res) => {
  try {
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId);
    const propertyId = req.query.propertyId;
    const scopedWhere = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
    if (!scopedWhere) return res.json({ count: 0 });
    const where = and25(scopedWhere, eq29(notification.read, false));
    const [row] = await db.select({ count: sql10`count(*)::int` }).from(notification).where(where);
    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to count notifications" });
  }
});
router26.put("/:notificationId/read", async (req, res) => {
  try {
    const notificationId = param(req, "notificationId");
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId);
    if (ownerPropertyIds.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }
    const [updated] = await db.update(notification).set({ read: true }).where(
      and25(
        eq29(notification.id, notificationId),
        inArray7(notification.propertyId, ownerPropertyIds)
      )
    ).returning();
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});
router26.post("/mark-all-read", async (req, res) => {
  try {
    const ownerPropertyIds = await getOwnerPropertyIds(req.ownerId);
    const propertyId = req.body.propertyId;
    const scopedWhere = buildOwnerScopedWhere(ownerPropertyIds, propertyId);
    if (!scopedWhere) return res.json({ updated: 0 });
    const where = and25(scopedWhere, eq29(notification.read, false));
    await db.update(notification).set({ read: true }).where(where);
    res.json({ message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});
var notifications_default = router26;

// src/routes/tenant-documents.ts
import { Router as Router27 } from "express";
import { z as z22 } from "zod";
import { eq as eq30, and as and26 } from "drizzle-orm";
var router27 = Router27({ mergeParams: true });
var uploadSchema = z22.object({
  type: z22.enum(["aadhaar", "pan", "passport", "driving_license", "other"]),
  fileName: z22.string().min(1),
  fileUrl: z22.string().url().optional(),
  // Direct URL if not using R2
  fileBase64: z22.string().optional(),
  // Base64 encoded file for R2 upload
  contentType: z22.string().optional()
});
router27.use(requireAuth, requireOwner, requireProperty);
router27.get("/tenant/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(and26(eq30(tenant.id, tenantId), eq30(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    const documents = await db.select().from(tenantDocument).where(eq30(tenantDocument.tenantId, tenantId));
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});
router27.post("/tenant/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const body = uploadSchema.parse(req.body);
    const [t] = await db.select({ id: tenant.id }).from(tenant).where(and26(eq30(tenant.id, tenantId), eq30(tenant.propertyId, req.propertyId))).limit(1);
    if (!t) return res.status(404).json({ error: "Tenant not found" });
    let fileUrl = body.fileUrl || "";
    let fileSize = null;
    if (isR2Configured() && body.fileBase64) {
      const buffer = Buffer.from(body.fileBase64, "base64");
      const contentType = body.contentType || "application/octet-stream";
      const result = await uploadToR2(`kyc/${tenantId}`, body.fileName, buffer, contentType);
      fileUrl = result.url;
      fileSize = result.size;
    } else if (!fileUrl) {
      return res.status(400).json({ error: "Either fileUrl or fileBase64 with R2 config required" });
    }
    const [created] = await db.insert(tenantDocument).values({
      tenantId,
      type: body.type,
      fileName: body.fileName,
      fileUrl,
      fileSize
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z22.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to upload document" });
  }
});
router27.delete("/:documentId", async (req, res) => {
  try {
    const documentId = param(req, "documentId");
    const [doc] = await db.select().from(tenantDocument).innerJoin(tenant, eq30(tenantDocument.tenantId, tenant.id)).where(and26(eq30(tenantDocument.id, documentId), eq30(tenant.propertyId, req.propertyId))).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (isR2Configured() && doc.tenant_document.fileUrl.includes("r2")) {
      try {
        const key = doc.tenant_document.fileUrl.split("/").slice(-3).join("/");
        await deleteFromR2(key);
      } catch {
      }
    }
    await db.delete(tenantDocument).where(eq30(tenantDocument.id, documentId));
    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});
var tenant_documents_default = router27;

// src/routes/admin-documents.ts
import { Router as Router28 } from "express";
import { z as z23 } from "zod";
import { eq as eq31, and as and27 } from "drizzle-orm";
var router28 = Router28({ mergeParams: true });
var uploadSchema2 = z23.object({
  name: z23.string().min(1).max(200),
  type: z23.enum(["agreement", "license", "insurance", "other"]),
  fileName: z23.string().min(1),
  fileUrl: z23.string().url().optional(),
  fileBase64: z23.string().optional(),
  contentType: z23.string().optional()
});
router28.use(requireAuth, requireOwner, requireProperty);
router28.get("/", async (req, res) => {
  try {
    const documents = await db.select().from(adminDocument).where(eq31(adminDocument.propertyId, req.propertyId));
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});
router28.post("/", async (req, res) => {
  try {
    const body = uploadSchema2.parse(req.body);
    let fileUrl = body.fileUrl || "";
    let fileSize = null;
    if (isR2Configured() && body.fileBase64) {
      const buffer = Buffer.from(body.fileBase64, "base64");
      const contentType = body.contentType || "application/octet-stream";
      const result = await uploadToR2(`admin/${req.propertyId}`, body.fileName, buffer, contentType);
      fileUrl = result.url;
      fileSize = result.size;
    } else if (!fileUrl) {
      return res.status(400).json({ error: "Either fileUrl or fileBase64 with R2 config required" });
    }
    const [created] = await db.insert(adminDocument).values({
      propertyId: req.propertyId,
      name: body.name,
      type: body.type,
      fileName: body.fileName,
      fileUrl,
      fileSize
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z23.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to upload document" });
  }
});
router28.delete("/:documentId", async (req, res) => {
  try {
    const documentId = param(req, "documentId");
    const [doc] = await db.select().from(adminDocument).where(and27(eq31(adminDocument.id, documentId), eq31(adminDocument.propertyId, req.propertyId))).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (isR2Configured() && doc.fileUrl.includes("r2")) {
      try {
        const key = doc.fileUrl.split("/").slice(-3).join("/");
        await deleteFromR2(key);
      } catch {
      }
    }
    await db.delete(adminDocument).where(eq31(adminDocument.id, documentId));
    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});
var admin_documents_default = router28;

// src/routes/permissions.ts
import { Router as Router29 } from "express";
import { z as z24 } from "zod";
import { eq as eq32, and as and28 } from "drizzle-orm";
var router29 = Router29({ mergeParams: true });
var createSchema9 = z24.object({
  staffId: z24.string().uuid(),
  module: z24.enum(["tenants", "billing", "expenses", "reports", "structure"]),
  canView: z24.boolean().default(false),
  canEdit: z24.boolean().default(false),
  canDelete: z24.boolean().default(false)
});
var updateSchema5 = z24.object({
  canView: z24.boolean().optional(),
  canEdit: z24.boolean().optional(),
  canDelete: z24.boolean().optional()
});
router29.use(requireAuth, requireOwner, requireProperty);
router29.get("/staff/:staffId", async (req, res) => {
  try {
    const staffId = param(req, "staffId");
    const [s] = await db.select({ id: staff.id }).from(staff).where(and28(eq32(staff.id, staffId), eq32(staff.propertyId, req.propertyId))).limit(1);
    if (!s) return res.status(404).json({ error: "Staff not found" });
    const permissions = await db.select().from(modulePermission).where(eq32(modulePermission.staffId, staffId));
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});
router29.post("/", async (req, res) => {
  try {
    const body = createSchema9.parse(req.body);
    const [s] = await db.select({ id: staff.id }).from(staff).where(and28(eq32(staff.id, body.staffId), eq32(staff.propertyId, req.propertyId))).limit(1);
    if (!s) return res.status(404).json({ error: "Staff not found" });
    const [existing] = await db.select({ id: modulePermission.id }).from(modulePermission).where(
      and28(
        eq32(modulePermission.staffId, body.staffId),
        eq32(modulePermission.module, body.module)
      )
    ).limit(1);
    if (existing) {
      const [updated] = await db.update(modulePermission).set({
        canView: body.canView,
        canEdit: body.canEdit,
        canDelete: body.canDelete,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq32(modulePermission.id, existing.id)).returning();
      return res.json(updated);
    }
    const [created] = await db.insert(modulePermission).values({
      propertyId: req.propertyId,
      staffId: body.staffId,
      module: body.module,
      canView: body.canView,
      canEdit: body.canEdit,
      canDelete: body.canDelete
    }).returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z24.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to set permission" });
  }
});
router29.delete("/:permissionId", async (req, res) => {
  try {
    const permissionId = param(req, "permissionId");
    const [deleted] = await db.delete(modulePermission).where(and28(eq32(modulePermission.id, permissionId), eq32(modulePermission.propertyId, req.propertyId))).returning();
    if (!deleted) return res.status(404).json({ error: "Permission not found" });
    res.json({ message: "Permission deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete permission" });
  }
});
var permissions_default = router29;

// src/routes/structure.ts
import { Router as Router30 } from "express";
import { z as z25 } from "zod";
import { eq as eq33, inArray as inArray8 } from "drizzle-orm";
var router30 = Router30({ mergeParams: true });
router30.use(requireAuth, requireOwner, requireProperty);
router30.get("/export", async (req, res) => {
  try {
    const floors = await db.select().from(floor).where(eq33(floor.propertyId, req.propertyId));
    const rooms = await db.select().from(room).where(eq33(room.propertyId, req.propertyId));
    const roomIds = rooms.map((r) => r.id);
    const beds = roomIds.length > 0 ? await db.select().from(bed).where(inArray8(bed.roomId, roomIds)) : [];
    const structure = floors.map((f) => ({
      floor: f.name,
      position: f.position,
      rooms: rooms.filter((r) => r.floorId === f.id).map((r) => ({
        number: r.number,
        type: r.type,
        capacity: r.capacity,
        monthlyRent: r.monthlyRent,
        beds: beds.filter((b) => b.roomId === r.id).map((b) => ({
          number: b.number,
          status: b.status,
          monthlyRent: b.monthlyRent
        }))
      }))
    }));
    const unassignedRooms = rooms.filter((r) => !r.floorId);
    if (unassignedRooms.length > 0) {
      structure.push({
        floor: "Unassigned",
        position: 999,
        rooms: unassignedRooms.map((r) => ({
          number: r.number,
          type: r.type,
          capacity: r.capacity,
          monthlyRent: r.monthlyRent,
          beds: beds.filter((b) => b.roomId === r.id).map((b) => ({
            number: b.number,
            status: b.status,
            monthlyRent: b.monthlyRent
          }))
        }))
      });
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=structure.json");
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: "Failed to export structure" });
  }
});
router30.post("/import", async (req, res) => {
  try {
    const importSchema = z25.array(
      z25.object({
        floor: z25.string(),
        position: z25.number().optional(),
        rooms: z25.array(
          z25.object({
            number: z25.string(),
            type: z25.enum(["single", "double", "triple", "dormitory"]).default("single"),
            capacity: z25.number().min(1).default(1),
            monthlyRent: z25.number().min(0).default(0),
            beds: z25.array(
              z25.object({
                number: z25.string(),
                monthlyRent: z25.number().min(0).optional()
              })
            ).optional()
          })
        )
      })
    );
    const structure = importSchema.parse(req.body);
    const results = await db.transaction(async (tx) => {
      let floorsCreated = 0;
      let roomsCreated = 0;
      let bedsCreated = 0;
      for (const floorData of structure) {
        const [f] = await tx.insert(floor).values({
          propertyId: req.propertyId,
          name: floorData.floor,
          position: floorData.position ?? floorsCreated
        }).returning();
        floorsCreated++;
        if (!f) continue;
        for (const roomData of floorData.rooms) {
          const [r] = await tx.insert(room).values({
            propertyId: req.propertyId,
            floorId: f.id,
            number: roomData.number,
            type: roomData.type,
            capacity: roomData.capacity,
            monthlyRent: roomData.monthlyRent
          }).returning();
          roomsCreated++;
          if (!r) continue;
          const bedCount = roomData.beds?.length ?? roomData.capacity;
          for (let i = 0; i < bedCount; i++) {
            const bedNumber = roomData.beds?.[i]?.number ?? String.fromCharCode(65 + i);
            await tx.insert(bed).values({
              roomId: r.id,
              number: bedNumber,
              monthlyRent: roomData.beds?.[i]?.monthlyRent
            });
            bedsCreated++;
          }
        }
      }
      return { floorsCreated, roomsCreated, bedsCreated };
    });
    res.status(201).json({
      message: `Imported ${results.floorsCreated} floors, ${results.roomsCreated} rooms, ${results.bedsCreated} beds`,
      ...results
    });
  } catch (error) {
    if (error instanceof z25.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to import structure" });
  }
});
var structure_default = router30;

// src/routes/whatsapp.ts
import { Router as Router31 } from "express";
import { eq as eq34, and as and30, sql as sql11 } from "drizzle-orm";

// src/lib/whatsapp.ts
var WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
var WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
var WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
var WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
var WHATSAPP_TEMPLATES_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;
var WHATSAPP_HEADER_IMAGE_URL = process.env.WHATSAPP_HEADER_IMAGE_URL;
function isWhatsAppConfigured() {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}
function isTemplateManagementConfigured() {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_BUSINESS_ACCOUNT_ID);
}
async function createTemplate(template) {
  if (!isTemplateManagementConfigured()) {
    return { success: false, error: "WhatsApp Business Account ID not configured" };
  }
  try {
    const response = await fetch(WHATSAPP_TEMPLATES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
async function listTemplates() {
  if (!isTemplateManagementConfigured()) {
    return { success: false, error: "WhatsApp Business Account ID not configured" };
  }
  try {
    const response = await fetch(WHATSAPP_TEMPLATES_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }
    return { success: true, templates: data.data || [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
async function setupPGKhataTemplates() {
  const templates = [
    {
      name: "monthly_bill_ready",
      category: "UTILITY",
      language: "en",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "PGKhata Monthly Bill"
        },
        {
          type: "BODY",
          text: "Hi {{1}}, your {{2}} bill for {{3}} Room {{4}} is ready.\n\nRent: \u20B9{{5}}\nElectricity: \u20B9{{6}}\nOther charges: \u20B9{{7}}\n\nTotal due: \u20B9{{8}}\n\nDue by {{9}}. Pay by UPI to {{10}}.\n\nSave this message as your bill receipt."
        },
        {
          type: "FOOTER",
          text: "Powered by PGKhata"
        }
      ]
    },
    {
      name: "payment_reminder",
      category: "UTILITY",
      language: "en",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}},\n\nYour rent for {{2}} at {{3}} Room {{4}} is \u20B9{{5}}.\n\nDue: {{6}}.\n\nPlease make sure to pay on or before the due date to avoid any inconvenience."
        },
        {
          type: "FOOTER",
          text: "Powered by PGKhata"
        }
      ]
    },
    {
      name: "rent_due_reminder",
      category: "UTILITY",
      language: "en",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}},\n\nYour rent for {{2}} Room {{3}} is \u20B9{{4}}.\n\nDue: {{5}}.\n\nPlease pay on time to avoid late fees."
        },
        {
          type: "FOOTER",
          text: "Powered by PGKhata"
        }
      ]
    }
  ];
  const results = [];
  for (const template of templates) {
    const result = await createTemplate(template);
    results.push({
      name: template.name,
      success: result.success,
      error: result.error
    });
  }
  return {
    success: results.every((r) => r.success),
    results
  };
}
async function sendWhatsAppMessage(message) {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: "WhatsApp not configured" };
  }
  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "template",
        template: {
          name: message.templateName,
          language: {
            code: message.languageCode || "en"
          },
          components: message.components || []
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status}`
      };
    }
    return {
      success: true,
      messageId: data.messages?.[0]?.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendBillNotification(params) {
  const components = [];
  const imageUrl = params.headerImageUrl || WHATSAPP_HEADER_IMAGE_URL;
  if (!imageUrl) {
    return { success: false, error: "WHATSAPP_HEADER_IMAGE_URL is required for the monthly bill template" };
  }
  components.push({
    type: "header",
    parameters: [
      {
        type: "image",
        image: { link: imageUrl }
      }
    ]
  });
  components.push({
    type: "body",
    parameters: [
      { type: "text", parameter_name: "tenant_name", text: params.tenantName },
      { type: "text", parameter_name: "bill_month", text: params.billMonth },
      { type: "text", parameter_name: "property_room", text: `${params.propertyName} Room ${params.roomNumber}` },
      { type: "text", parameter_name: "rent_amount", text: String(params.rentAmount) },
      { type: "text", parameter_name: "electricity_amount", text: String(params.electricityAmount) },
      { type: "text", parameter_name: "other_charges", text: String(params.otherCharges) },
      { type: "text", parameter_name: "total_amount", text: String(params.totalAmount) },
      { type: "text", parameter_name: "due_date", text: params.dueDate },
      { type: "text", parameter_name: "upi_id", text: params.upiId || "N/A" }
    ]
  });
  return sendWhatsAppMessage({
    to: `91${params.phone}`,
    templateName: "monthly_bill_ready",
    languageCode: "en",
    components
  });
}
async function sendPaymentReminder(params) {
  return sendWhatsAppMessage({
    to: `91${params.phone}`,
    templateName: "rent_payment_reminder",
    languageCode: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "tenant_name", text: params.tenantName },
          { type: "text", parameter_name: "month", text: params.billMonth },
          { type: "text", parameter_name: "property_room", text: `${params.propertyName} Room ${params.roomNumber}` },
          { type: "text", parameter_name: "amount", text: String(params.amount) },
          { type: "text", parameter_name: "due_date", text: params.dueDate }
        ]
      }
    ]
  });
}

// src/routes/whatsapp.ts
var router31 = Router31({ mergeParams: true });
router31.use(requireAuth, requireOwner, requireProperty);
router31.get("/status", async (req, res) => {
  res.json({
    configured: isWhatsAppConfigured(),
    templateManagement: isTemplateManagementConfigured()
  });
});
router31.get("/templates", async (req, res) => {
  try {
    const result = await listTemplates();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to list templates" });
  }
});
router31.post("/setup-templates", async (req, res) => {
  try {
    const result = await setupPGKhataTemplates();
    res.json({
      message: result.success ? "All templates created successfully" : "Some templates failed to create",
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to setup templates" });
  }
});
router31.post("/send-bill/:billId", async (req, res) => {
  try {
    const billId = param(req, "billId");
    const [row] = await db.select({
      bill,
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      roomNumber: room.number,
      propertyName: property.name,
      upiId: property.upiVpa
    }).from(bill).innerJoin(tenant, eq34(bill.tenantId, tenant.id)).leftJoin(room, eq34(tenant.roomId, room.id)).innerJoin(property, eq34(tenant.propertyId, property.id)).where(and30(eq34(bill.id, billId), eq34(tenant.propertyId, req.propertyId))).limit(1);
    if (!row) return res.status(404).json({ error: "Bill not found" });
    const lineItems = row.bill.lineItems;
    const rentAmount = lineItems.find((l) => l.code === "RENT")?.amount ?? 0;
    const electricityAmount = lineItems.find((l) => l.code === "ELEC")?.amount ?? 0;
    const otherCharges = row.bill.totalAmount - rentAmount - electricityAmount;
    const result = await sendBillNotification({
      phone: row.tenantPhone,
      tenantName: row.tenantName,
      propertyName: row.propertyName,
      roomNumber: row.roomNumber || "N/A",
      billMonth: row.bill.billMonth,
      rentAmount,
      electricityAmount,
      otherCharges,
      totalAmount: row.bill.totalAmount,
      dueDate: row.bill.dueDate ? new Date(row.bill.dueDate).toLocaleDateString("en-IN") : "N/A",
      upiId: row.upiId || void 0
    });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json({ message: "Bill notification sent", messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to send bill notification" });
  }
});
router31.post("/send-reminder/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [row] = await db.select({
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      roomNumber: room.number,
      propertyName: property.name
    }).from(tenant).leftJoin(room, eq34(tenant.roomId, room.id)).innerJoin(property, eq34(tenant.propertyId, property.id)).where(and30(eq34(tenant.id, tenantId), eq34(tenant.propertyId, req.propertyId))).limit(1);
    if (!row) return res.status(404).json({ error: "Tenant not found" });
    const [unpaidBill] = await db.select().from(bill).where(and30(eq34(bill.tenantId, tenantId), sql11`${bill.balance} > 0`)).orderBy(bill.billMonth).limit(1);
    if (!unpaidBill) {
      return res.status(409).json({ error: "No unpaid bills for this tenant" });
    }
    const result = await sendPaymentReminder({
      phone: row.tenantPhone,
      tenantName: row.tenantName,
      propertyName: row.propertyName,
      roomNumber: row.roomNumber || "N/A",
      billMonth: unpaidBill.billMonth,
      amount: unpaidBill.balance,
      dueDate: unpaidBill.dueDate ? new Date(unpaidBill.dueDate).toLocaleDateString("en-IN") : "N/A"
    });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json({ message: "Payment reminder sent", messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to send payment reminder" });
  }
});
router31.post("/send-bulk-reminders", async (req, res) => {
  try {
    const unpaidBills = await db.select({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      roomNumber: room.number,
      propertyName: property.name,
      billMonth: bill.billMonth,
      balance: bill.balance,
      dueDate: bill.dueDate
    }).from(bill).innerJoin(tenant, eq34(bill.tenantId, tenant.id)).leftJoin(room, eq34(tenant.roomId, room.id)).innerJoin(property, eq34(tenant.propertyId, property.id)).where(and30(eq34(tenant.propertyId, req.propertyId), sql11`${bill.balance} > 0`));
    if (unpaidBills.length === 0) {
      return res.json({ message: "No unpaid bills", sent: 0, failed: 0 });
    }
    let sent = 0;
    let failed = 0;
    for (const row of unpaidBills) {
      const result = await sendPaymentReminder({
        phone: row.tenantPhone,
        tenantName: row.tenantName,
        propertyName: row.propertyName,
        roomNumber: row.roomNumber || "N/A",
        billMonth: row.billMonth,
        amount: row.balance,
        dueDate: row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-IN") : "N/A"
      });
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }
    res.json({
      message: `Sent ${sent} reminders, ${failed} failed`,
      sent,
      failed,
      total: unpaidBills.length
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send bulk reminders" });
  }
});
var whatsapp_default = router31;

// src/routes/police-verification.ts
import { Router as Router32 } from "express";
import { eq as eq35, and as and31, sql as sql12 } from "drizzle-orm";
var router32 = Router32({ mergeParams: true });
router32.use(requireAuth, requireOwner, requireProperty);
router32.get("/", async (req, res) => {
  try {
    const propertyId = req.propertyId;
    const rows = await db.select({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email,
      aadhaarNumber: tenant.aadhaarNumber,
      panNumber: tenant.panNumber,
      roomId: tenant.roomId,
      roomNumber: room.number,
      floorName: floor.name,
      joiningDate: tenant.joiningDate,
      policeVerificationStatus: tenant.policeVerificationStatus,
      policeVerificationDate: tenant.policeVerificationDate,
      policeVerificationNotes: tenant.policeVerificationNotes
    }).from(tenant).leftJoin(room, eq35(tenant.roomId, room.id)).leftJoin(floor, eq35(room.floorId, floor.id)).where(and31(eq35(tenant.propertyId, propertyId), sql12`${tenant.status} != 'deleted'`)).orderBy(tenant.name);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch police verification status" });
  }
});
router32.patch("/:tenantId", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const { status, notes } = req.body;
    const validStatuses = ["pending", "submitted", "verified", "rejected", "not_required"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }
    const [updated] = await db.update(tenant).set({
      policeVerificationStatus: status,
      policeVerificationDate: status === "submitted" ? /* @__PURE__ */ new Date() : void 0,
      policeVerificationNotes: notes
    }).where(and31(eq35(tenant.id, tenantId), eq35(tenant.propertyId, req.propertyId))).returning();
    if (!updated) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update police verification status" });
  }
});
router32.get("/:tenantId/form", async (req, res) => {
  try {
    const tenantId = param(req, "tenantId");
    const [row] = await db.select({
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email,
      aadhaarNumber: tenant.aadhaarNumber,
      panNumber: tenant.panNumber,
      permanentAddress: tenant.permanentAddress,
      joiningDate: tenant.joiningDate,
      propertyName: property.name,
      propertyAddress: property.address,
      roomNumber: room.number,
      floorName: floor.name
    }).from(tenant).innerJoin(property, eq35(tenant.propertyId, property.id)).leftJoin(room, eq35(tenant.roomId, room.id)).leftJoin(floor, eq35(room.floorId, floor.id)).where(and31(eq35(tenant.id, tenantId), eq35(tenant.propertyId, req.propertyId))).limit(1);
    if (!row) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const formData = {
      // Property details
      propertyName: row.propertyName,
      propertyAddress: row.propertyAddress,
      // Tenant details
      tenantName: row.tenantName,
      tenantPhone: row.tenantPhone,
      tenantEmail: row.tenantEmail,
      aadhaarNumber: row.aadhaarNumber,
      panNumber: row.panNumber,
      permanentAddress: row.permanentAddress,
      // Stay details
      roomNumber: row.roomNumber,
      floorName: row.floorName,
      joiningDate: row.joiningDate,
      // Form metadata
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      formType: "police_verification"
    };
    res.json(formData);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate police verification form" });
  }
});
router32.get("/stats", async (req, res) => {
  try {
    const propertyId = req.propertyId;
    const stats = await db.select({
      status: tenant.policeVerificationStatus,
      count: sql12`count(*)::int`
    }).from(tenant).where(and31(eq35(tenant.propertyId, propertyId), sql12`${tenant.status} != 'deleted'`)).groupBy(tenant.policeVerificationStatus);
    const result = {
      total: 0,
      pending: 0,
      submitted: 0,
      verified: 0,
      rejected: 0,
      not_required: 0
    };
    for (const row of stats) {
      const status = row.status || "pending";
      result[status] = row.count;
      result.total += row.count;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch verification statistics" });
  }
});
var police_verification_default = router32;

// src/index.ts
var app = express();
var logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"]
});
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID2();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});
app.use(helmet());
if (!process.env.CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN environment variable is required");
}
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
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
app.use("/v1/properties/:propertyId/floors", floors_default);
app.use("/v1/properties/:propertyId/rent-plans", rent_plans_default);
app.use("/v1/properties/:propertyId/charge-types", charge_types_default);
app.use("/v1/properties/:propertyId/rooms/:roomId/beds", room_beds_default);
app.use("/v1/properties/:propertyId/rooms", rooms_default);
app.use("/v1/properties/:propertyId/beds", beds_default);
app.use("/v1/properties/:propertyId/tenants", tenants_default);
app.use("/v1/properties/:propertyId/readings", readings_default);
app.use("/v1/properties/:propertyId/bills", billing_default);
app.use("/v1/properties/:propertyId/payments", payments_default);
app.use("/v1/properties/:propertyId/advance-payments", advance_payments_default);
app.use("/v1/properties/:propertyId/security-deposits", security_deposits_default);
app.use("/v1/properties/:propertyId/expenses", expenses_default);
app.use("/v1/properties/:propertyId/reminders", reminders_default);
app.use("/v1/properties/:propertyId/emergency-contacts", emergency_contacts_default);
app.use("/v1/properties/:propertyId/bed-bookings", bed_bookings_default);
app.use("/v1/properties/:propertyId/staff", staff_default);
app.use("/v1/properties/:propertyId/exports", exports_default);
app.use("/v1/properties/:propertyId/amenities", amenities_default);
app.use("/v1/properties/:propertyId/billing-policy", billing_policy_default);
app.use("/v1/properties/:propertyId/notification-preferences", notification_preferences_default);
app.use("/v1/notifications", notifications_default);
app.use("/v1/properties/:propertyId/tenant-documents", tenant_documents_default);
app.use("/v1/properties/:propertyId/admin-documents", admin_documents_default);
app.use("/v1/properties/:propertyId/permissions", permissions_default);
app.use("/v1/properties/:propertyId/structure", structure_default);
app.use("/v1/properties/:propertyId/whatsapp", whatsapp_default);
app.use("/v1/properties/:propertyId/police-verification", police_verification_default);
app.use("/v1/dashboard", dashboard_default);
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
//# sourceMappingURL=chunk-FY6GX6B3.js.map