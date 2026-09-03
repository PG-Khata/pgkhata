CREATE INDEX "idx_electricity_reading_room_date" ON "electricity_reading" USING btree ("room_id","reading_date");--> statement-breakpoint
CREATE INDEX "idx_payment_bill_id" ON "payment" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_property_status" ON "tenant" USING btree ("property_id","status");