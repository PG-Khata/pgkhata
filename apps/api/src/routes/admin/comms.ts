import { Router } from "express";
import { z } from "zod";
import {
  db,
  messageDelivery,
  ownerProfile,
  property,
  user,
  MESSAGE_CHANNELS,
  MESSAGE_DELIVERY_STATUSES,
} from "@pgkhata/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { requireSuperAdminRole } from "../../middleware/admin";
import { pagination, sendPage, MAX_PAGE_SIZE } from "../../lib/pagination";
import { countAll, dateParam, every, idParam, parseFilters } from "../../lib/admin-list";
import {
  isTemplateManagementConfigured,
  listTemplates,
  setupPGKhataTemplates,
} from "../../lib/whatsapp";

/**
 * Delivery and messaging operations. Guarded by the root gate in ./index.ts —
 * do not add a `router.use(...)` here: every admin sub-router is mounted at
 * "/", so router-level middleware runs for requests a sibling router handles.
 *
 * Reads `message_delivery`, whose single writer is `recordDelivery` in
 * `src/lib/delivery.ts`.
 */
const router = Router();

/* ---------------------------------------------------------------- templates */

/**
 * WhatsApp templates used to sit at `/v1/properties/:propertyId/whatsapp/*`,
 * which was wrong in a way that cost money: a template is one asset on the
 * platform's own Meta WABA, shared by every owner. Any owner who hit
 * `setup-templates` was re-creating templates in *our* Meta account on behalf
 * of everybody. Both routes now live here, behind the admin gate, and the
 * owner-facing pair is deleted.
 */
router.get("/whatsapp/templates", async (_req, res) => {
  if (!isTemplateManagementConfigured()) {
    return res.status(503).json({ error: "WhatsApp template management is not configured" });
  }

  const result = await listTemplates();
  // 502, not 500: the failure is Meta's, and an admin staring at this page needs
  // to know the difference between "we are broken" and "Graph API said no".
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.templates);
});

/**
 * Creates the platform's templates on Meta. `requireSuperAdminRole` because it
 * mutates a shared external asset that every owner's messaging depends on —
 * that is not a support action, and unlike everything else here it is not a read.
 */
router.post("/whatsapp/setup-templates", requireSuperAdminRole, async (_req, res) => {
  if (!isTemplateManagementConfigured()) {
    return res.status(503).json({ error: "WhatsApp template management is not configured" });
  }

  const result = await setupPGKhataTemplates();
  res.json({
    message: result.success
      ? "All templates created successfully"
      : "Some templates failed to create",
    ...result,
  });
});

/* --------------------------------------------------------------- deliveries */

/**
 * Enums come from the schema's own vocabularies rather than being retyped, so a
 * new channel or status cannot be queryable in the database but rejected here.
 */
const deliveryFilterSchema = z.object({
  status: z.enum(MESSAGE_DELIVERY_STATUSES).optional(),
  channel: z.enum(MESSAGE_CHANNELS).optional(),
  ownerId: idParam.optional(),
  since: dateParam.optional(),
});

type DeliveryFilters = z.infer<typeof deliveryFilterSchema>;

/**
 * Shared by the feed and the summary so the two can never disagree on what a
 * filter means.
 *
 * `message_delivery` carries no owner column — nothing in this schema does
 * except `property.owner_id` — so an owner filter is expressed as the same
 * `propertyId -> property.ownerId` hop the rest of the app uses. Both callers
 * therefore join `property`.
 */
function deliveryWhere(filters: DeliveryFilters) {
  return every(
    filters.status ? eq(messageDelivery.status, filters.status) : undefined,
    filters.channel ? eq(messageDelivery.channel, filters.channel) : undefined,
    filters.ownerId ? eq(property.ownerId, filters.ownerId) : undefined,
    filters.since ? gte(messageDelivery.createdAt, filters.since) : undefined,
  );
}

/**
 * The delivery feed. Open to `support` deliberately: "the tenant says they never
 * got the bill" is the support job, and answering it is a read.
 *
 * `status` is left unfiltered by default rather than pinned to failures. The
 * question support is actually handed is "what happened to this message", and
 * the useful answer is as often "sent at 15:42 to this number" as it is a
 * failure — `?status=failed` narrows it to the failures queue.
 */
router.get("/deliveries", async (req, res) => {
  const filters = parseFilters(req, res, deliveryFilterSchema);
  if (!filters) return;
  const page = pagination(req);

  const rows = await db
    .select({
      delivery: messageDelivery,
      ownerId: property.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      propertyName: property.name,
    })
    .from(messageDelivery)
    // Left joins throughout: a platform email (an OTP, a password reset) has no
    // property and so no owner, and those are exactly the rows the "I never got
    // the OTP" question is about. An inner join would hide them.
    .leftJoin(property, eq(messageDelivery.propertyId, property.id))
    .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
    .leftJoin(user, eq(ownerProfile.userId, user.id))
    .where(deliveryWhere(filters))
    // Matches idx_message_delivery_status_created / _channel_created, which are
    // (column, created_at DESC) precisely for this read.
    .orderBy(desc(messageDelivery.createdAt))
    .limit(page.limit)
    .offset(page.offset);

  sendPage(res, rows, page);
});

const summarySchema = deliveryFilterSchema.extend({
  groupBy: z.enum(["owner", "property", "channel", "day"]).default("owner"),
});

const messages = countAll;
const failed = sql<number>`(count(*) filter (where ${messageDelivery.status} = 'failed'))::int`;
const costUnits = sql<number>`coalesce(sum(${messageDelivery.costUnits}), 0)::int`;

/**
 * Counts and billable units per owner, property, channel or day.
 *
 * This is the "what does this owner cost me" number. Meta bills per WhatsApp
 * template message and the platform pays for all of them, so until this log
 * existed the answer was a guess.
 *
 * Bounded at MAX_PAGE_SIZE rather than paginated: every grouping but `day` is
 * naturally small, and `day` is ordered newest-first so the cap reads as "the
 * last hundred days" rather than an arbitrary truncation.
 */
router.get("/deliveries/summary", async (req, res) => {
  const filters = parseFilters(req, res, summarySchema);
  if (!filters) return;

  const where = deliveryWhere(filters);
  const totals = { messages, failed, costUnits };

  if (filters.groupBy === "owner") {
    // A null key is the platform itself: OTPs and password resets, which belong
    // to no owner. That is a real and interesting row, not a defect.
    const rows = await db
      .select({ key: property.ownerId, label: user.name, ...totals })
      .from(messageDelivery)
      .leftJoin(property, eq(messageDelivery.propertyId, property.id))
      .leftJoin(ownerProfile, eq(property.ownerId, ownerProfile.id))
      .leftJoin(user, eq(ownerProfile.userId, user.id))
      .where(where)
      .groupBy(property.ownerId, user.name)
      .orderBy(desc(costUnits))
      .limit(MAX_PAGE_SIZE);
    return res.json({ groupBy: filters.groupBy, rows });
  }

  if (filters.groupBy === "property") {
    const rows = await db
      .select({ key: messageDelivery.propertyId, label: property.name, ...totals })
      .from(messageDelivery)
      .leftJoin(property, eq(messageDelivery.propertyId, property.id))
      .where(where)
      .groupBy(messageDelivery.propertyId, property.name)
      .orderBy(desc(costUnits))
      .limit(MAX_PAGE_SIZE);
    return res.json({ groupBy: filters.groupBy, rows });
  }

  if (filters.groupBy === "channel") {
    const rows = await db
      .select({ key: messageDelivery.channel, label: messageDelivery.channel, ...totals })
      .from(messageDelivery)
      .leftJoin(property, eq(messageDelivery.propertyId, property.id))
      .where(where)
      .groupBy(messageDelivery.channel)
      .orderBy(desc(costUnits))
      .limit(MAX_PAGE_SIZE);
    return res.json({ groupBy: filters.groupBy, rows });
  }

  const day = sql<string>`to_char(${messageDelivery.createdAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ key: day, label: day, ...totals })
    .from(messageDelivery)
    .leftJoin(property, eq(messageDelivery.propertyId, property.id))
    .where(where)
    .groupBy(day)
    .orderBy(desc(day))
    .limit(MAX_PAGE_SIZE);
  res.json({ groupBy: filters.groupBy, rows });
});

export default router;
