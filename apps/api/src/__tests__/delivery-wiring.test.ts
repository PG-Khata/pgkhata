import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Every message the platform sends must land in `message_delivery`.
 *
 * `deliverBill` used to be the only send path that recorded anything, so
 * WhatsApp — which costs real money per template message — and the auth emails
 * behind "I never got the OTP" left no trace at all. These tests pin the wiring
 * itself: that each send path calls `recordDelivery` on success *and* on
 * failure, that the bulk route cannot run past its cap, and that WhatsApp
 * template management is no longer reachable by an owner.
 *
 * Unit-level throughout. The integration suites need TEST_DATABASE_URL, which is
 * unset by default, so the database is a scripted stand-in and the assertions
 * are about which calls the routes make rather than what Postgres stores.
 */

const h = vi.hoisted(() => {
  /**
   * A drizzle query builder that records the chain and answers each awaited
   * query with the next scripted result. Every builder method returns the same
   * proxy, so `.select().from().innerJoin().where().limit()` composes exactly as
   * the real one does, and `then` is what makes the chain awaitable — that is
   * the point the route hands control back, so it is where a result is handed
   * over.
   */
  const state = {
    queue: [] as unknown[][],
    calls: [] as { method: string; args: unknown[] }[],
  };

  const chain: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) => resolve(state.queue.shift() ?? []);
        }
        if (typeof property !== "string") return undefined;
        return (...args: unknown[]) => {
          state.calls.push({ method: property, args });
          return chain;
        };
      },
    },
  );

  return {
    // Inside the hoisted block because the `vi.mock` factories below run before
    // any top-level binding in this file exists.
    PROPERTY_ID: "11111111-1111-4111-8111-111111111111",
    BULK_CAP: 3,
    state,
    db: chain,
    recordDelivery: vi.fn<(entry: unknown) => Promise<void>>(async () => {}),
    deliverBill: vi.fn(async () => [{ channel: "email", status: "sent" }]),
    sendBillNotification: vi.fn(),
    sendPaymentReminder: vi.fn(),
    isWhatsAppConfigured: vi.fn(() => true),
  };
});

vi.mock("@pgkhata/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@pgkhata/db")>()),
  db: h.db,
}));

vi.mock("../lib/delivery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/delivery")>()),
  recordDelivery: h.recordDelivery,
  deliverBill: h.deliverBill,
  // Overridden so the cap is reachable in a test without scripting 200 rows.
  // The real value is asserted separately below.
  MAX_BULK_REMINDERS: h.BULK_CAP,
}));

vi.mock("../lib/whatsapp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/whatsapp")>()),
  sendBillNotification: h.sendBillNotification,
  sendPaymentReminder: h.sendPaymentReminder,
  isWhatsAppConfigured: h.isWhatsAppConfigured,
}));

// The guards are exercised by admin-route-guards.test.ts and the impersonation
// suites; here they would only stand between the test and the handler.
vi.mock("../middleware/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../middleware/auth")>()),
  requireAuth: function requireAuth(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
  requireOwner: function requireOwner(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock("../middleware/property", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../middleware/property")>()),
  requireProperty: function requireProperty(
    req: { propertyId?: string },
    _res: unknown,
    next: () => void,
  ) {
    req.propertyId = h.PROPERTY_ID;
    next();
  },
}));

const PROPERTY_ID = h.PROPERTY_ID;
const BULK_CAP = h.BULK_CAP;

import { auth, setAuthDeliveryRecorder } from "@pgkhata/auth";
import { sendEmail } from "@pgkhata/email";
import whatsappRouter from "../routes/whatsapp";
import remindersRouter from "../routes/reminders";
import adminRouter from "../routes/admin";

function appWith(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const whatsappApp = appWith(whatsappRouter);
const remindersApp = appWith(remindersRouter);

/** Queues the results the next queries will return, in execution order. */
function scriptQueries(...results: unknown[][]) {
  h.state.queue = results;
}

function billRow(overrides: Record<string, unknown> = {}) {
  return {
    bill: {
      id: "22222222-2222-4222-8222-222222222222",
      billMonth: "2026-01",
      totalAmount: 9000,
      balance: 9000,
      dueDate: null,
      lineItems: [{ code: "RENT", name: "Rent", amount: 9000 }],
    },
    tenantId: "33333333-3333-4333-8333-333333333333",
    tenantName: "Asha",
    tenantPhone: "9876543210",
    roomNumber: "101",
    propertyName: "Green PG",
    upiId: "green@upi",
    ...overrides,
  };
}

function reminderRow(index: number) {
  return {
    billId: `4444444${index}-4444-4444-8444-444444444444`,
    tenantId: `5555555${index}-5555-4555-8555-555555555555`,
    tenantName: `Tenant ${index}`,
    tenantPhone: `98765432${10 + index}`,
    roomNumber: `10${index}`,
    propertyName: "Green PG",
    billMonth: "2026-01",
    balance: 5000,
    dueDate: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.queue = [];
  h.state.calls = [];
  h.isWhatsAppConfigured.mockReturnValue(true);
  h.deliverBill.mockResolvedValue([{ channel: "email", status: "sent" }]);
  setAuthDeliveryRecorder(null);
});

/** The single argument `recordDelivery` was called with on call `index`. */
function recorded(index = 0) {
  return h.recordDelivery.mock.calls[index]?.[0] as Record<string, unknown> | undefined;
}

describe("POST /send-bill/:billId records every outcome", () => {
  it("records a sent message with the provider message id", async () => {
    scriptQueries([billRow()]);
    h.sendBillNotification.mockResolvedValue({ success: true, messageId: "wamid.SENT" });

    const res = await request(whatsappApp).post(
      "/send-bill/22222222-2222-4222-8222-222222222222",
    );

    expect(res.status).toBe(200);
    expect(h.recordDelivery).toHaveBeenCalledTimes(1);
    expect(recorded()).toMatchObject({
      propertyId: PROPERTY_ID,
      channel: "whatsapp",
      kind: "bill",
      status: "sent",
      providerMessageId: "wamid.SENT",
      recipient: "9876543210",
    });
  });

  it("records a provider rejection instead of discarding it", async () => {
    scriptQueries([billRow()]);
    h.sendBillNotification.mockResolvedValue({ success: false, error: "Template not approved" });

    const res = await request(whatsappApp).post(
      "/send-bill/22222222-2222-4222-8222-222222222222",
    );

    expect(res.status).toBe(500);
    expect(recorded()).toMatchObject({ status: "failed", error: "Template not approved" });
  });

  it("records a thrown send, which used to vanish into the catch-all 500", async () => {
    scriptQueries([billRow()]);
    h.sendBillNotification.mockRejectedValue(new Error("socket hang up"));

    const res = await request(whatsappApp).post(
      "/send-bill/22222222-2222-4222-8222-222222222222",
    );

    expect(res.status).toBe(500);
    expect(recorded()).toMatchObject({ status: "failed", error: "socket hang up" });
  });

  it("records a skip when WhatsApp is unconfigured, and does not call the provider", async () => {
    scriptQueries([billRow()]);
    h.isWhatsAppConfigured.mockReturnValue(false);

    const res = await request(whatsappApp).post(
      "/send-bill/22222222-2222-4222-8222-222222222222",
    );

    expect(res.status).toBe(503);
    expect(h.sendBillNotification).not.toHaveBeenCalled();
    expect(recorded()).toMatchObject({ status: "skipped" });
  });

  it("writes nothing when the bill is not the caller's", async () => {
    scriptQueries([]);

    const res = await request(whatsappApp).post(
      "/send-bill/22222222-2222-4222-8222-222222222222",
    );

    expect(res.status).toBe(404);
    expect(h.recordDelivery).not.toHaveBeenCalled();
  });
});

describe("POST /send-reminder/:tenantId records every outcome", () => {
  const tenantId = "33333333-3333-4333-8333-333333333333";
  const unpaid = {
    id: "22222222-2222-4222-8222-222222222222",
    billMonth: "2026-01",
    balance: 4000,
    dueDate: null,
  };
  const tenantRow = {
    tenantName: "Asha",
    tenantPhone: "9876543210",
    roomNumber: "101",
    propertyName: "Green PG",
  };

  it("records a sent reminder", async () => {
    scriptQueries([tenantRow], [unpaid]);
    h.sendPaymentReminder.mockResolvedValue({ success: true, messageId: "wamid.REMIND" });

    const res = await request(whatsappApp).post(`/send-reminder/${tenantId}`);

    expect(res.status).toBe(200);
    expect(recorded()).toMatchObject({
      channel: "whatsapp",
      kind: "reminder",
      status: "sent",
      providerMessageId: "wamid.REMIND",
      billId: unpaid.id,
    });
  });

  it("records a failed reminder", async () => {
    scriptQueries([tenantRow], [unpaid]);
    h.sendPaymentReminder.mockResolvedValue({ success: false, error: "Invalid number" });

    const res = await request(whatsappApp).post(`/send-reminder/${tenantId}`);

    expect(res.status).toBe(500);
    expect(recorded()).toMatchObject({ status: "failed", error: "Invalid number" });
  });
});

describe("POST /send-bulk-reminders is capped", () => {
  it("stops at MAX_BULK_REMINDERS and reports the remainder", async () => {
    const rows = [reminderRow(1), reminderRow(2), reminderRow(3)];
    // Five unpaid bills exist; the cap is three.
    scriptQueries([{ total: 5 }], rows);
    h.sendPaymentReminder.mockResolvedValue({ success: true, messageId: "wamid.BULK" });

    const res = await request(whatsappApp).post("/send-bulk-reminders");

    expect(res.status).toBe(200);
    expect(h.sendPaymentReminder).toHaveBeenCalledTimes(BULK_CAP);
    expect(h.recordDelivery).toHaveBeenCalledTimes(BULK_CAP);
    expect(res.body).toMatchObject({
      sent: BULK_CAP,
      failed: 0,
      attempted: BULK_CAP,
      total: 5,
      truncated: true,
      remaining: 2,
      cap: BULK_CAP,
    });
    // Truncation the caller can see, rather than silently sending fewer.
    expect(res.body.message).toContain("2");
  });

  it("asks the database for no more than the cap", async () => {
    scriptQueries([{ total: 5 }], [reminderRow(1)]);
    h.sendPaymentReminder.mockResolvedValue({ success: true, messageId: "wamid.BULK" });

    await request(whatsappApp).post("/send-bulk-reminders");

    // The old loop selected every unpaid bill in the property and sent to all of
    // them; the bound has to be in the query, not just in the loop.
    expect(
      h.state.calls.some((call) => call.method === "limit" && call.args[0] === BULK_CAP),
    ).toBe(true);
  });

  it("does not report truncation when everything fits", async () => {
    scriptQueries([{ total: 2 }], [reminderRow(1), reminderRow(2)]);
    h.sendPaymentReminder.mockResolvedValue({ success: true, messageId: "wamid.BULK" });

    const res = await request(whatsappApp).post("/send-bulk-reminders");

    expect(res.body).toMatchObject({ sent: 2, truncated: false, remaining: 0 });
  });

  it("records each failure and keeps going", async () => {
    scriptQueries([{ total: 3 }], [reminderRow(1), reminderRow(2), reminderRow(3)]);
    h.sendPaymentReminder
      .mockResolvedValueOnce({ success: true, messageId: "wamid.1" })
      .mockResolvedValueOnce({ success: false, error: "Invalid number" })
      .mockRejectedValueOnce(new Error("socket hang up"));

    const res = await request(whatsappApp).post("/send-bulk-reminders");

    expect(res.body).toMatchObject({ sent: 1, failed: 2 });
    // One row per attempt: a run nobody metered is exactly what this replaces.
    expect(h.recordDelivery).toHaveBeenCalledTimes(3);
    expect(recorded(1)).toMatchObject({ status: "failed", error: "Invalid number" });
    expect(recorded(2)).toMatchObject({ status: "failed", error: "socket hang up" });
  });

  it("records a skip per tenant when WhatsApp is unconfigured", async () => {
    scriptQueries([{ total: 2 }], [reminderRow(1), reminderRow(2)]);
    h.isWhatsAppConfigured.mockReturnValue(false);

    const res = await request(whatsappApp).post("/send-bulk-reminders");

    expect(h.sendPaymentReminder).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ sent: 0, skipped: 2 });
    expect(recorded()).toMatchObject({ status: "skipped" });
  });

  it("sends and records nothing when there are no unpaid bills", async () => {
    scriptQueries([{ total: 0 }]);

    const res = await request(whatsappApp).post("/send-bulk-reminders");

    expect(res.body).toMatchObject({ sent: 0, total: 0, truncated: false });
    expect(h.recordDelivery).not.toHaveBeenCalled();
  });

  it("ships a cap that is a real positive bound", async () => {
    const actual = await vi.importActual<typeof import("../lib/delivery")>("../lib/delivery");
    expect(Number.isInteger(actual.MAX_BULK_REMINDERS)).toBe(true);
    expect(actual.MAX_BULK_REMINDERS).toBeGreaterThan(0);
    expect(actual.MAX_BULK_REMINDERS).toBeLessThanOrEqual(1000);
  });
});

describe("POST /reminders/send runs through the shared delivery path", () => {
  const billIds = ["22222222-2222-4222-8222-222222222222"];
  const row = {
    bill: { id: billIds[0], billMonth: "2026-01", totalAmount: 9000, balance: 9000 },
    tenant: { id: "33333333-3333-4333-8333-333333333333", name: "Asha", email: "a@example.com" },
    roomNumber: "101",
    propertyName: "Green PG",
    upiId: "green@upi",
  };

  it("delegates to deliverBill rather than sending email itself", async () => {
    scriptQueries([row]);

    const res = await request(remindersApp).post("/send").send({ billIds, channel: "email" });

    expect(res.status).toBe(200);
    expect(h.deliverBill).toHaveBeenCalledTimes(1);
    expect(h.deliverBill).toHaveBeenCalledWith(row, ["email"], "reminder");
    expect(res.body.results[0]).toMatchObject({
      billId: billIds[0],
      tenantId: row.tenant.id,
      channel: "email",
      status: "sent",
    });
  });

  it("actually sends WhatsApp instead of answering not_implemented", async () => {
    scriptQueries([row]);
    h.deliverBill.mockResolvedValue([
      { channel: "email", status: "sent" },
      { channel: "whatsapp", status: "sent" },
    ]);

    const res = await request(remindersApp).post("/send").send({ billIds, channel: "both" });

    expect(h.deliverBill).toHaveBeenCalledWith(row, ["email", "whatsapp"], "reminder");
    const statuses = res.body.results.map((r: { status: string }) => r.status);
    expect(statuses).not.toContain("not_implemented");
    expect(JSON.stringify(res.body)).not.toContain("not_implemented");
  });

  it("still rejects a malformed request", async () => {
    const res = await request(remindersApp).post("/send").send({ billIds: [] });
    expect(res.status).toBe(400);
    expect(h.deliverBill).not.toHaveBeenCalled();
  });
});

/* --------------------------------------------------------------- route moves */

interface Layer {
  name: string;
  handle?: { stack?: Layer[] };
  route?: { path: string; methods: Record<string, boolean>; stack: { name: string }[] };
}

interface MountedRoute {
  id: string;
  path: string;
  handlers: string[];
}

function mountedRoutes(router: unknown): MountedRoute[] {
  const out: MountedRoute[] = [];
  const walk = (stack: Layer[]) => {
    for (const layer of stack) {
      if (layer.route) {
        const handlers = layer.route.stack.map((entry) => entry.name);
        for (const method of Object.keys(layer.route.methods)) {
          out.push({ id: `${method.toUpperCase()} ${layer.route.path}`, path: layer.route.path, handlers });
        }
        continue;
      }
      if (layer.handle?.stack) walk(layer.handle.stack);
    }
  };
  walk((router as { stack: Layer[] }).stack);
  return out;
}

describe("WhatsApp template management moved to the admin surface", () => {
  const ownerRoutes = mountedRoutes(whatsappRouter);
  const adminRoutes = mountedRoutes(adminRouter);

  it.each(["/templates", "/setup-templates"])(
    "no longer serves %s to an owner",
    (path) => {
      // A template is one asset on the platform's own Meta WABA. An owner
      // calling setup-templates was re-creating templates in our account for
      // everybody, which is why this cannot come back by accident.
      expect(ownerRoutes.map((route) => route.path)).not.toContain(path);
    },
  );

  it("keeps the owner's own send routes", () => {
    expect(ownerRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/status",
        "/send-bill/:billId",
        "/send-reminder/:tenantId",
        "/send-bulk-reminders",
      ]),
    );
  });

  it.each([
    "GET /whatsapp/templates",
    "POST /whatsapp/setup-templates",
    "GET /deliveries",
    "GET /deliveries/summary",
  ])("mounts %s on the admin router", (id) => {
    expect(adminRoutes.map((route) => route.id)).toContain(id);
  });

  it("restricts template creation to super_admin and leaves the feed to support", () => {
    const setup = adminRoutes.find((route) => route.id === "POST /whatsapp/setup-templates");
    expect(setup?.handlers).toContain("adminGuard:super_admin");

    // Chasing a failed bill is the support job, so the read-only feed must not
    // be narrowed to super_admin.
    const feed = adminRoutes.find((route) => route.id === "GET /deliveries");
    expect(feed?.handlers).not.toContain("adminGuard:super_admin");
  });
});

/* ------------------------------------------------------------- auth emails */

describe("auth emails are recorded without becoming load bearing", () => {
  const user = { id: "user-1", email: "Owner@Example.com", name: "Owner" };
  const resetArgs = { user, url: "https://app/reset", token: "tok" };

  function sendReset() {
    const send = auth.options.emailAndPassword?.sendResetPassword;
    expect(send, "sendResetPassword is configured").toBeTypeOf("function");
    return send!(resetArgs as unknown as Parameters<NonNullable<typeof send>>[0]);
  }

  it("records a sent password reset", async () => {
    const recorder = vi.fn();
    setAuthDeliveryRecorder(recorder);

    await sendReset();

    expect(recorder).toHaveBeenCalledWith({
      propertyId: null,
      channel: "email",
      kind: "password_reset",
      recipient: user.email,
      template: "password_reset",
      status: "sent",
    });
  });

  it("records a failed password reset and still surfaces the failure", async () => {
    const recorder = vi.fn();
    setAuthDeliveryRecorder(recorder);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Resend is down"));

    await expect(sendReset()).rejects.toThrow("Resend is down");
    expect(recorder).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "Resend is down" }),
    );
  });

  it("does not let a broken recorder break a password reset", async () => {
    // The whole point of the hook: logging is observability, and observability
    // that can lock a user out of their account is worse than none.
    setAuthDeliveryRecorder(() => {
      throw new Error("delivery log is down");
    });

    await expect(sendReset()).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("sends normally when no recorder is wired", async () => {
    setAuthDeliveryRecorder(null);
    await expect(sendReset()).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("records the OTP path too", async () => {
    // The emailOTP plugin closes over `sendVerificationOTP`, so unlike
    // `sendResetPassword` it cannot be reached through `auth.options`. Pin it at
    // the source instead: both outcomes must reach the recorder, and the OTP
    // itself must never be one of the things recorded.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(import.meta.dirname, "../../../../packages/auth/src/auth.ts"),
      "utf8",
    );
    const otpBlock = source.slice(source.indexOf("sendVerificationOTP"));
    expect(otpBlock).toContain('kind: "otp"');
    expect(otpBlock).toContain('status: "sent"');
    expect(otpBlock).toContain('status: "failed"');
    expect(otpBlock).not.toContain("otp,\n");
  });
});
