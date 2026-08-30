ALTER TABLE "tenant" ADD COLUMN "bed_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."bed"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_bed_uq" ON "tenant" USING btree ("bed_id") WHERE "tenant"."bed_id" is not null;