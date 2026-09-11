ALTER TABLE "platform_admin" ADD COLUMN "role" text DEFAULT 'support' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Backward compatibility: rows that predate roles had unconditional access, so
-- leaving them at the 'support' default would lock the founder out of every
-- destructive route on deploy. They become what they already were. This runs in
-- the same transaction as the ADD COLUMN above, so no live pod ever observes
-- an existing admin as 'support'.
UPDATE "platform_admin" SET "role" = 'super_admin';--> statement-breakpoint
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_created_by_platform_admin_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_admin"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_role_check" CHECK ("platform_admin"."role" in ('super_admin', 'support'));--> statement-breakpoint
-- 0025's DO block attached this trigger only to tables that existed then, so
-- every updated_at column added afterwards needs it created explicitly.
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_admin
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();