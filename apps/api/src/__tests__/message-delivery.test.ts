import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The delivery log is the only evidence that a message was ever sent, so the
 * properties worth pinning are the ones support and finance depend on:
 *
 *   1. every send lands exactly one row, including the ones that never left,
 *   2. WhatsApp is metered and email is free — the cost column is the whole
 *      reason this table exists rather than a log line,
 *   3. a logging outage cannot become a delivery outage.
 *
 * Unit-level on purpose: the integration suite needs TEST_DATABASE_URL, which
 * is unset by default, and none of the above is a question about SQL.
 */

const h = vi.hoisted(() => {
  const inserted: Array<Record<string, unknown>> = [];
  const logged: unknown[][] = [];
  let insertFails = false;

  return {
    inserted,
    logged,
    failInserts: (value: boolean) => {
      insertFails = value;
    },
    db: {
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          if (insertFails) throw new Error("connection terminated unexpectedly");
          inserted.push(values);
        },
      }),
    },
  };
});

vi.mock("@pgkhata/db", () => ({
  db: h.db,
  messageDelivery: {},
  bill: {},
  tenant: {},
  room: {},
  property: {},
}));

vi.mock("../lib/logger", () => ({
  logger: { error: (...args: unknown[]) => h.logged.push(args) },
}));

const { MAX_BULK_REMINDERS, deliverBill, normaliseRecipient, recordDelivery, shareMessage } =
  await import("../lib/delivery");

type BillRow = Parameters<typeof deliverBill>[0];

function billRow(overrides: { email?: string | null } = {}): BillRow {
  return {
    bill: {
      id: "bill-1",
      billMonth: "2026-08",
      totalAmount: 1200,
      balance: 1200,
      dueDate: "2026-09-05",
      accessToken: "tok-1",
      lineItems: [
        { code: "RENT", amount: 1000 },
        { code: "ELEC", amount: 150 },
      ],
    },
    tenant: {
      id: "tenant-1",
      propertyId: "property-1",
      name: "Asha",
      phone: "9876543210",
      email: "email" in overrides ? overrides.email : "Asha@Example.COM",
    },
    roomNumber: "101",
    propertyName: "Sunrise PG",
    upiId: "sunrise@upi",
  } as unknown as BillRow;
}

beforeEach(() => {
  h.inserted.length = 0;
  h.logged.length = 0;
  h.failInserts(false);
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("recordDelivery", () => {
  it("meters a WhatsApp template send and keeps its provider message id", async () => {
    await recordDelivery({
      propertyId: "property-1",
      tenantId: "tenant-1",
      billId: "bill-1",
      recipient: "9876543210",
      channel: "whatsapp",
      kind: "reminder",
      template: "rent_payment_reminder",
      status: "sent",
      providerMessageId: "wamid.abc",
    });

    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0]).toMatchObject({
      propertyId: "property-1",
      tenantId: "tenant-1",
      billId: "bill-1",
      // Country code included: this is the number Meta was actually given.
      recipient: "919876543210",
      channel: "whatsapp",
      kind: "reminder",
      template: "rent_payment_reminder",
      status: "sent",
      provider: "meta",
      providerMessageId: "wamid.abc",
      costUnits: 1,
    });
  });

  it("charges nothing for email, and nothing for WhatsApp that never left", async () => {
    await recordDelivery({
      recipient: " Owner@Example.com ",
      channel: "email",
      kind: "otp",
      template: "otp",
      status: "sent",
    });
    await recordDelivery({
      recipient: "9876543210",
      channel: "whatsapp",
      kind: "reminder",
      status: "failed",
      error: "Template not approved",
    });
    await recordDelivery({
      recipient: "9876543210",
      channel: "whatsapp",
      kind: "reminder",
      status: "skipped",
      error: "WhatsApp delivery is not configured",
    });

    expect(h.inserted.map((row) => row.costUnits)).toEqual([0, 0, 0]);
    // An auth email has no property yet, and that must be a recorded null
    // rather than a reason not to record the send at all.
    expect(h.inserted[0]).toMatchObject({
      propertyId: null,
      tenantId: null,
      billId: null,
      recipient: "owner@example.com",
      provider: "resend",
      status: "sent",
    });
    expect(h.inserted[1]).toMatchObject({ status: "failed", error: "Template not approved" });
    expect(h.inserted[2]).toMatchObject({
      status: "skipped",
      error: "WhatsApp delivery is not configured",
    });
  });

  it("honours an explicit cost override", async () => {
    await recordDelivery({
      recipient: "9876543210",
      channel: "whatsapp",
      kind: "bill",
      status: "sent",
      costUnits: 0,
    });
    expect(h.inserted[0]).toMatchObject({ costUnits: 0 });
  });

  it("swallows a logging failure loudly instead of failing the send", async () => {
    h.failInserts(true);

    await expect(
      recordDelivery({ recipient: "a@b.com", channel: "email", kind: "otp", status: "sent" }),
    ).resolves.toBeUndefined();

    expect(h.logged).toHaveLength(1);
    expect(h.logged[0]?.[1]).toBe("DELIVERY LOG WRITE FAILED");
  });
});

describe("normaliseRecipient", () => {
  it("stores the address as it went on the wire", () => {
    expect(normaliseRecipient("email", "  Tenant@Example.COM ")).toBe("tenant@example.com");
    expect(normaliseRecipient("whatsapp", "98765 43210")).toBe("919876543210");
    expect(normaliseRecipient("whatsapp", "+91 98765-43210")).toBe("919876543210");
    // Nothing known — a skipped send still gets a row, with an empty address.
    expect(normaliseRecipient("email", null)).toBe("");
  });
});

describe("deliverBill", () => {
  it("records one row per channel, including the channels it skipped", async () => {
    const results = await deliverBill(billRow(), ["email", "whatsapp"]);

    expect(results).toEqual([
      { channel: "email", status: "skipped", reason: "Email delivery is not configured" },
      { channel: "whatsapp", status: "skipped", reason: "WhatsApp delivery is not configured" },
    ]);
    expect(h.inserted).toHaveLength(2);
    expect(h.inserted[0]).toMatchObject({
      propertyId: "property-1",
      tenantId: "tenant-1",
      billId: "bill-1",
      channel: "email",
      kind: "bill",
      status: "skipped",
      costUnits: 0,
    });
    expect(h.inserted[1]).toMatchObject({ channel: "whatsapp", status: "skipped", costUnits: 0 });
  });

  it("records a sent email against the address it was sent to", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "bills@pgkhata.test";

    const results = await deliverBill(billRow(), ["email"], "reminder");

    expect(results).toEqual([{ channel: "email", status: "sent", reason: undefined }]);
    expect(h.inserted[0]).toMatchObject({
      channel: "email",
      kind: "reminder",
      status: "sent",
      recipient: "asha@example.com",
      provider: "resend",
      template: "bill_ready",
      providerMessageId: "test-email",
      costUnits: 0,
    });
  });

  it("still records the send it declined to make when the tenant has no email", async () => {
    const results = await deliverBill(billRow({ email: null }), ["email"]);

    expect(results).toEqual([
      { channel: "email", status: "skipped", reason: "Tenant has no email address" },
    ]);
    expect(h.inserted[0]).toMatchObject({ status: "skipped", recipient: "" });
  });

  it("keeps the owner-facing share message unchanged by the extraction", () => {
    const message = shareMessage(billRow());
    expect(message).toContain("your 2026-08 bill for Sunrise PG Room 101 is ready");
    expect(message).toContain("Pay by UPI to sunrise@upi");
  });
});

describe("bulk reminder ceiling", () => {
  it("publishes a finite cap next to the sender that spends the money", () => {
    expect(MAX_BULK_REMINDERS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_BULK_REMINDERS)).toBe(true);
  });
});

describe("migration 0030", () => {
  const sql = readFileSync(
    resolve(import.meta.dirname, "../../../../packages/db/drizzle/0030_add_message_delivery.sql"),
    "utf8",
  );

  it("creates the table with the enum and metering constraints", () => {
    expect(sql).toContain('CREATE TABLE "message_delivery"');
    expect(sql).toContain("message_delivery_channel_check");
    expect(sql).toContain("message_delivery_kind_check");
    expect(sql).toContain("message_delivery_status_check");
    expect(sql).toContain("'otp'");
    expect(sql).toContain("'password_reset'");
    expect(sql).toContain("'complaint_ack'");
    expect(sql).toContain("'queued'");
  });

  it("indexes the three ways the log is read, newest first", () => {
    for (const column of ["property_id", "status", "channel"]) {
      expect(sql).toMatch(
        new RegExp(`CREATE INDEX "idx_message_delivery_\\w+" ON "message_delivery" USING btree \\("${column}","created_at" DESC`),
      );
    }
  });

  it("is append-only, so it needs no set_updated_at trigger", () => {
    // 0025 attached the trigger by a one-shot DO block over the tables that
    // existed then; a new table would have to create the trigger by hand.
    // Having neither the column nor the trigger is the only combination that
    // is not a bug, so this reads the executable statements, not the prose.
    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(statements).not.toContain("updated_at");
    expect(statements).not.toContain("CREATE TRIGGER");
  });

  it("backfills from bill_delivery and leaves that table standing", () => {
    expect(sql).toMatch(/INSERT INTO "message_delivery"[\s\S]*FROM "bill_delivery"/);
    // Historical WhatsApp sends are metered too, or the first cost report is
    // wrong the day it is written.
    expect(sql).toMatch(/CASE WHEN "bd"\."channel" = 'whatsapp' AND "bd"\."status" = 'sent' THEN 1/);
    expect(sql).not.toMatch(/DROP TABLE\s+"?bill_delivery/i);
  });

  it("derives ownership through property rather than storing an owner_id", () => {
    expect(sql).not.toContain('"owner_id"');
  });
});

describe("delivery extraction", () => {
  const routeSource = readFileSync(resolve(import.meta.dirname, "../routes/billing.ts"), "utf8");

  it("leaves no second writer for the delivery log in the route file", () => {
    expect(routeSource).toContain('from "../lib/delivery"');
    expect(routeSource).not.toContain("billDelivery");
    expect(routeSource).not.toContain("async function deliverBill");
  });
});
