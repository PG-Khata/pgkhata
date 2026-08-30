import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    // restrict, not cascade: deleting a property must not silently erase its
    // tenants and, through them, every bill and payment ever recorded.
    .references(() => property.id, { onDelete: "restrict" }),
  roomId: uuid("room_id")
    .references(() => room.id, { onDelete: "set null" }),
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
});

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
    totalAmount: integer("total_amount").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0),
    balance: integer("balance").notNull(),
    status: text("status").notNull().default("pending"),
    dueDate: timestamp("due_date"),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Billing idempotency. The generation loop checked for an existing bill
    // first, but two concurrent runs both passed the check and both inserted.
    // The legacy schema had this constraint; the rebuild dropped it.
    uniqueIndex("bill_tenant_month_uq").on(table.tenantId, table.billMonth),
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
