-- One delivery record for every message the platform sends, on any channel.
--
-- A new table rather than a widening of bill_delivery: that table's bill_id is
-- NOT NULL and foreign-keyed to bill, so an OTP, a password reset or an
-- onboarding email has nowhere to go. Those are precisely the sends support is
-- asked about ("I never got the code"), and today they leave no trace at all.
-- WhatsApp is worse than untraceable: Meta bills per conversation and nothing
-- counts them, which is what cost_units exists to fix.
--
-- Strictly additive, and safe to apply while the current code is still serving.
-- The table is new, so no running pod can be broken by it, and bill_delivery is
-- left exactly where it is -- backfilled below, then read-only -- so a rollback
-- to the previous release loses nothing.
--
-- No updated_at, therefore no trigger work: a delivery attempt is an
-- append-only fact about a moment, not a mutable entity. (Migration 0025
-- attached set_updated_at via a one-shot DO block over the tables that existed
-- then; any *new* table with an updated_at would have to CREATE TRIGGER by
-- hand. This one deliberately has none.)
--
-- No owner_id either: ownership is reached through property -> owner_id like
-- everywhere else in this schema, so the two can never drift apart, and an auth
-- email sent before any property exists simply carries a null property_id.
CREATE TABLE "message_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"tenant_id" uuid,
	"bill_id" uuid,
	"recipient" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"template" text,
	"status" text NOT NULL,
	"error" text,
	"provider" text,
	"provider_message_id" text,
	"cost_units" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_delivery_channel_check" CHECK ("message_delivery"."channel" in ('email', 'whatsapp')),
	CONSTRAINT "message_delivery_kind_check" CHECK ("message_delivery"."kind" in ('bill', 'reminder', 'otp', 'password_reset', 'onboarding', 'complaint_ack')),
	CONSTRAINT "message_delivery_status_check" CHECK ("message_delivery"."status" in ('queued', 'sent', 'failed', 'skipped')),
	CONSTRAINT "message_delivery_cost_units_check" CHECK ("message_delivery"."cost_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "message_delivery" ADD CONSTRAINT "message_delivery_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_delivery" ADD CONSTRAINT "message_delivery_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_delivery" ADD CONSTRAINT "message_delivery_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_delivery_property_created" ON "message_delivery" USING btree ("property_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_message_delivery_status_created" ON "message_delivery" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_message_delivery_channel_created" ON "message_delivery" USING btree ("channel","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Backfill the historical bill deliveries so the new table is the single place
-- to answer "did the tenant get this bill", from the first row onwards rather
-- than from deploy day. bill.tenant_id and tenant.property_id are both NOT
-- NULL, so these joins are total and the row count is preserved exactly.
--
-- recipient is reconstructed from the tenant's *current* address, which is the
-- best available evidence: bill_delivery never recorded where it sent. Empty
-- string where none is known -- which is itself the reason most 'skipped' rows
-- are skipped. Going forward lib/delivery.ts records the address actually used.
--
-- cost_units is charged only to WhatsApp messages that were actually sent;
-- skipped and failed sends never opened a conversation and cost nothing.
INSERT INTO "message_delivery" (
	"property_id", "tenant_id", "bill_id", "recipient", "channel", "kind",
	"status", "error", "provider", "provider_message_id", "cost_units", "created_at"
)
SELECT
	"t"."property_id",
	"t"."id",
	"bd"."bill_id",
	COALESCE(CASE WHEN "bd"."channel" = 'email' THEN "t"."email" ELSE "t"."phone" END, ''),
	"bd"."channel",
	"bd"."kind",
	"bd"."status",
	"bd"."error",
	CASE WHEN "bd"."channel" = 'email' THEN 'resend' ELSE 'meta' END,
	"bd"."provider_message_id",
	CASE WHEN "bd"."channel" = 'whatsapp' AND "bd"."status" = 'sent' THEN 1 ELSE 0 END,
	"bd"."created_at"
FROM "bill_delivery" "bd"
JOIN "bill" "b" ON "b"."id" = "bd"."bill_id"
JOIN "tenant" "t" ON "t"."id" = "b"."tenant_id"
-- Defensive: the CHECK constraints above are the contract for new rows, and a
-- legacy row with an unrecognised channel or kind must not fail the migration.
WHERE "bd"."channel" IN ('email', 'whatsapp')
  AND "bd"."kind" IN ('bill', 'reminder')
  AND "bd"."status" IN ('queued', 'sent', 'failed', 'skipped');
