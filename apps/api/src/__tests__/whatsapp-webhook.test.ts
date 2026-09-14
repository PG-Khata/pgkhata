import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const sets: Array<Record<string, unknown>> = [];
  const returnedRows: Array<{ id: string }> = [{ id: "delivery-1" }];
  const chain = {
    set(values: Record<string, unknown>) {
      sets.push(values);
      return chain;
    },
    where() {
      return chain;
    },
    async returning() {
      return returnedRows;
    },
  };

  return {
    sets,
    returnedRows,
    update: vi.fn(() => chain),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

vi.mock("@pgkhata/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@pgkhata/db")>()),
  db: { update: h.update },
}));

vi.mock("../lib/logger", () => ({
  logger: { warn: h.warn, error: h.error },
}));

const { default: whatsappWebhookRouter, metaFailureReason, verifyMetaSignature } =
  await import("../routes/whatsapp-webhook");

const APP_SECRET = "meta-app-secret";
const VERIFY_TOKEN = "webhook-verify-token";

function webhookApp() {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(whatsappWebhookRouter);
  return app;
}

function signature(payload: string) {
  return `sha256=${createHmac("sha256", APP_SECRET).update(payload).digest("hex")}`;
}

function statusPayload(status: "sent" | "delivered" | "read" | "failed", errors?: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "messages",
        value: { statuses: [{ id: "wamid.MESSAGE", status, errors }] },
      }],
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.sets.length = 0;
  h.returnedRows.splice(0, h.returnedRows.length, { id: "delivery-1" });
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
});

describe("WhatsApp webhook verification", () => {
  it("returns Meta's challenge only for the configured verification token", async () => {
    const verified = await request(webhookApp()).get("/").query({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "challenge-123",
    });
    expect(verified.status).toBe(200);
    expect(verified.text).toBe("challenge-123");

    const rejected = await request(webhookApp()).get("/").query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "challenge-123",
    });
    expect(rejected.status).toBe(403);
  });

  it("rejects a POST that was not signed by the Meta app", async () => {
    const response = await request(webhookApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", "sha256=deadbeef")
      .send(JSON.stringify(statusPayload("sent")));

    expect(response.status).toBe(401);
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("WhatsApp delivery status", () => {
  it("promotes a queued request to sent only after Meta posts sent", async () => {
    const payload = JSON.stringify(statusPayload("sent"));
    const response = await request(webhookApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signature(payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(h.sets).toEqual([{ status: "sent", error: null, costUnits: 1 }]);
  });

  it("stores Meta's failure reason instead of claiming the message was sent", async () => {
    const payload = JSON.stringify(statusPayload("failed", [{
      code: 131053,
      title: "Media upload error",
      error_data: { details: "Unable to download the header image" },
    }]));
    const response = await request(webhookApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signature(payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(h.sets).toEqual([{
      status: "failed",
      error: "Meta 131053: Unable to download the header image",
      costUnits: 0,
    }]);
  });
});

describe("WhatsApp webhook helpers", () => {
  it("uses a timing-safe HMAC comparison", () => {
    const body = Buffer.from('{"ok":true}');
    expect(verifyMetaSignature(body, signature(body.toString()), APP_SECRET)).toBe(true);
    expect(verifyMetaSignature(body, "sha256=00", APP_SECRET)).toBe(false);
  });

  it("formats a useful fallback failure", () => {
    expect(metaFailureReason({ status: "failed" })).toBe("WhatsApp delivery failed");
  });
});
