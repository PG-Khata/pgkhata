CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"admin_user_id" text NOT NULL,
	"admin_email" text NOT NULL,
	"impersonation_session_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"owner_id" uuid,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impersonation_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"admin_user_id" text NOT NULL,
	"target_owner_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"mode" text DEFAULT 'read_only' NOT NULL,
	"write_reason" text,
	"write_granted_at" timestamp with time zone,
	"write_expires_at" timestamp with time zone,
	"handoff_token_hash" text,
	"handoff_expires_at" timestamp with time zone,
	"handoff_claimed_at" timestamp with time zone,
	"session_token_hash" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "impersonation_session_handoff_token_hash_unique" UNIQUE("handoff_token_hash"),
	CONSTRAINT "impersonation_session_session_token_hash_unique" UNIQUE("session_token_hash"),
	CONSTRAINT "impersonation_session_mode_check" CHECK ("impersonation_session"."mode" in ('read_only', 'read_write')),
	CONSTRAINT "impersonation_session_write_window_check" CHECK ("impersonation_session"."mode" = 'read_only' or ("impersonation_session"."write_reason" is not null and "impersonation_session"."write_expires_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_platform_admin_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_impersonation_session_id_impersonation_session_id_fk" FOREIGN KEY ("impersonation_session_id") REFERENCES "public"."impersonation_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_session" ADD CONSTRAINT "impersonation_session_admin_id_platform_admin_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_session" ADD CONSTRAINT "impersonation_session_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_session" ADD CONSTRAINT "impersonation_session_target_owner_id_owner_profile_id_fk" FOREIGN KEY ("target_owner_id") REFERENCES "public"."owner_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_owner" ON "admin_audit_log" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_admin" ON "admin_audit_log" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_session" ON "admin_audit_log" USING btree ("impersonation_session_id");--> statement-breakpoint
CREATE INDEX "idx_impersonation_session_admin" ON "impersonation_session" USING btree ("admin_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_impersonation_session_owner" ON "impersonation_session" USING btree ("target_owner_id","started_at");--> statement-breakpoint
-- The audit log is the only place the real human actor exists for an escalated
-- impersonated write (domain tables attribute those to the owner), so an
-- application bug that UPDATEs or DELETEs here must fail loudly rather than
-- quietly rewrite evidence.
--
-- Scope, stated honestly: this stops bugs, not a compromised application role.
-- The app connects as the table owner, who can always DISABLE TRIGGER, so a
-- REVOKE would buy nothing extra. Real immutability needs a separate
-- least-privilege role, which is a worthwhile follow-up, not a blocker.
-- Retention deletes must ALTER TABLE ... DISABLE TRIGGER deliberately.
CREATE OR REPLACE FUNCTION public.admin_audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only (attempted %)', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_is_append_only();