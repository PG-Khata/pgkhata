ALTER TABLE "tenant" ADD COLUMN "requested_room_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "onboarding_token" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_requested_room_id_room_id_fk" FOREIGN KEY ("requested_room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_onboarding_token_unique" UNIQUE("onboarding_token");