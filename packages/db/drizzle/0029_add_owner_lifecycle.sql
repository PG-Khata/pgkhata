-- Owner account lifecycle: suspend / reactivate / soft-delete.
--
-- Strictly additive, and safe to apply while the current code is still serving:
-- every new column is nullable or carries a default, so writes issued by a pod
-- that has never heard of these columns keep succeeding and land on 'active' —
-- the state those accounts are already in.
--
-- Only owner_profile gains these columns. Nothing below the owner is reachable
-- except through it, so one gate at the account boundary is the entire
-- enforcement surface; deletion here is logical, and physical removal is a
-- separate purge phase.
--
-- owner_profile already carries the set_updated_at trigger attached by 0025's
-- one-shot DO block, so adding columns needs no trigger work. A *new* table
-- would — 0025 only covered what existed then.
ALTER TABLE "owner_profile" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD COLUMN "suspended_by" text;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD CONSTRAINT "owner_profile_suspended_by_user_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Admin listing filters on status; owner_profile is small enough that a plain
-- CREATE INDEX takes a negligible lock.
CREATE INDEX "idx_owner_profile_status" ON "owner_profile" USING btree ("status");--> statement-breakpoint
ALTER TABLE "owner_profile" ADD CONSTRAINT "owner_profile_status_check" CHECK ("owner_profile"."status" in ('active', 'suspended', 'pending_deletion', 'deleted'));--> statement-breakpoint
-- Coherence, not decoration: a suspended account with no suspended_at is one
-- support cannot date or explain when the customer asks why they were cut off.
ALTER TABLE "owner_profile" ADD CONSTRAINT "owner_profile_suspended_requires_timestamp" CHECK ("owner_profile"."status" <> 'suspended' or "owner_profile"."suspended_at" is not null);