import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { db, messageDelivery } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

type MetaStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: { statuses?: MetaStatus[] };
    }>;
  }>;
};

export function verifyMetaSignature(rawBody: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const supplied = Buffer.from(signature.slice("sha256=".length), "hex");
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"), "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function metaFailureReason(status: MetaStatus): string {
  const error = status.errors?.[0];
  const detail = error?.error_data?.details || error?.message || error?.title || "WhatsApp delivery failed";
  return error?.code ? `Meta ${error.code}: ${detail}` : detail;
}

function statusesFrom(body: MetaWebhookBody): MetaStatus[] {
  return (body.entry ?? []).flatMap((entry) =>
    (entry.changes ?? [])
      .filter((change) => change.field === "messages")
      .flatMap((change) => change.value?.statuses ?? []),
  );
}

router.get("/", (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!verifyToken) return res.status(503).send("WhatsApp webhook is not configured");
  if (mode !== "subscribe" || token !== verifyToken || typeof challenge !== "string") {
    return res.status(403).send("Webhook verification failed");
  }
  return res.status(200).send(challenge);
});

router.post("/", async (req, res) => {
  const appSecret = process.env.META_APP_SECRET;
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;

  if (!appSecret) return res.status(503).json({ error: "WhatsApp webhook is not configured" });
  if (!rawBody || !verifyMetaSignature(rawBody, req.header("x-hub-signature-256"), appSecret)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const body = req.body as MetaWebhookBody;
  if (body.object !== "whatsapp_business_account") return res.sendStatus(200);

  try {
    for (const providerStatus of statusesFrom(body)) {
      if (!providerStatus.id || !providerStatus.status) continue;

      const failed = providerStatus.status === "failed";
      const [updated] = await db
        .update(messageDelivery)
        .set({
          status: failed ? "failed" : "sent",
          error: failed ? metaFailureReason(providerStatus) : null,
          // Meta's sent/delivered/read callbacks confirm that the template
          // message left the platform. A failed callback must not be billed.
          costUnits: failed ? 0 : 1,
        })
        .where(eq(messageDelivery.providerMessageId, providerStatus.id))
        .returning({ id: messageDelivery.id });

      if (!updated) {
        logger.warn(
          { providerMessageId: providerStatus.id, providerStatus: providerStatus.status },
          "WhatsApp status did not match a recorded delivery",
        );
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    logger.error({ err: error }, "WhatsApp status webhook failed");
    return res.status(500).json({ error: "Could not record WhatsApp status" });
  }
});

export default router;
