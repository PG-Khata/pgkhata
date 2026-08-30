ALTER TABLE "bill" DROP CONSTRAINT "bill_tenant_id_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_bill_id_bill_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant" DROP CONSTRAINT "tenant_property_id_property_id_fk";
--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_tenant_month_uq" ON "bill" USING btree ("tenant_id","bill_month");--> statement-breakpoint
CREATE UNIQUE INDEX "room_property_number_uq" ON "room" USING btree ("property_id","number");