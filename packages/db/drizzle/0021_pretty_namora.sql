ALTER TABLE "complaint" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "complaint" ADD COLUMN "category" text DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "complaint" ADD COLUMN "priority" text DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;