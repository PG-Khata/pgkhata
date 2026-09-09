DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tenant t JOIN room r ON r.id = t.room_id WHERE t.property_id <> r.property_id)
    OR EXISTS (SELECT 1 FROM tenant t JOIN room r ON r.id = t.requested_room_id WHERE t.property_id <> r.property_id)
    OR EXISTS (SELECT 1 FROM tenant t JOIN bed b ON b.id = t.bed_id WHERE t.room_id IS DISTINCT FROM b.room_id)
    OR EXISTS (SELECT 1 FROM tenant WHERE bed_id IS NOT NULL AND (room_id IS NULL OR status <> 'active'))
    OR EXISTS (SELECT 1 FROM room r JOIN floor f ON f.id = r.floor_id WHERE r.property_id <> f.property_id)
    OR EXISTS (SELECT 1 FROM room r JOIN rent_plan p ON p.id = r.rent_plan_id WHERE r.property_id <> p.property_id)
    OR EXISTS (SELECT 1 FROM expense e JOIN expense_category c ON c.id = e.category_id WHERE e.property_id <> c.property_id)
    OR EXISTS (SELECT 1 FROM security_deposit d JOIN tenant t ON t.id = d.tenant_id WHERE d.property_id <> t.property_id)
    OR EXISTS (SELECT 1 FROM complaint c JOIN tenant t ON t.id = c.tenant_id WHERE c.property_id <> t.property_id)
    OR EXISTS (SELECT 1 FROM module_permission m JOIN staff s ON s.id = m.staff_id WHERE m.property_id <> s.property_id)
    OR EXISTS (SELECT 1 FROM occupancy_history GROUP BY bed_id HAVING count(*) FILTER (WHERE ended_on IS NULL) > 1)
  THEN
    RAISE EXCEPTION 'Cross-property or active-occupancy violations must be reconciled before migration 0025';
  END IF;

  IF EXISTS (SELECT 1 FROM billing_policy GROUP BY property_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM notification_preference GROUP BY property_id, event_type HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM module_permission GROUP BY property_id, staff_id, module HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM property_amenity GROUP BY property_id, lower(btrim(name)) HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM electricity_reading GROUP BY room_id, reading_date HAVING count(*) > 1)
  THEN
    RAISE EXCEPTION 'Duplicate singleton or natural-key rows must be reconciled before migration 0025';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX "idx_electricity_reading_room_date";--> statement-breakpoint
CREATE UNIQUE INDEX "floor_id_property_uq" ON "floor" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_plan_id_property_uq" ON "rent_plan" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_id_property_uq" ON "room" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bed_id_room_uq" ON "bed" USING btree ("id","room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_id_property_uq" ON "tenant" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_id_property_uq" ON "expense_category" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_id_property_uq" ON "staff" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_policy_property_uq" ON "billing_policy" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_property_event_uq" ON "notification_preference" USING btree ("property_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "module_permission_property_staff_module_uq" ON "module_permission" USING btree ("property_id","staff_id","module");--> statement-breakpoint
CREATE UNIQUE INDEX "property_amenity_property_name_uq" ON "property_amenity" USING btree ("property_id",lower(btrim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "electricity_reading_room_date_uq" ON "electricity_reading" USING btree ("room_id","reading_date");--> statement-breakpoint
CREATE UNIQUE INDEX "occupancy_history_one_open_per_bed_uq" ON "occupancy_history" USING btree ("bed_id") WHERE "occupancy_history"."ended_on" is null;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_floor_property_fk" FOREIGN KEY ("floor_id","property_id") REFERENCES "public"."floor"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_rent_plan_property_fk" FOREIGN KEY ("rent_plan_id","property_id") REFERENCES "public"."rent_plan"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_room_property_fk" FOREIGN KEY ("room_id","property_id") REFERENCES "public"."room"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_requested_room_property_fk" FOREIGN KEY ("requested_room_id","property_id") REFERENCES "public"."room"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_bed_room_fk" FOREIGN KEY ("bed_id","room_id") REFERENCES "public"."bed"("id","room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_property_fk" FOREIGN KEY ("category_id","property_id") REFERENCES "public"."expense_category"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_deposit" ADD CONSTRAINT "security_deposit_tenant_property_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "public"."tenant"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_tenant_property_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "public"."tenant"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_permission" ADD CONSTRAINT "module_permission_staff_property_fk" FOREIGN KEY ("staff_id","property_id") REFERENCES "public"."staff"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancy_history" ADD CONSTRAINT "occupancy_history_tenant_property_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "public"."tenant"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancy_history" ADD CONSTRAINT "occupancy_history_room_property_fk" FOREIGN KEY ("room_id","property_id") REFERENCES "public"."room"("id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancy_history" ADD CONSTRAINT "occupancy_history_bed_room_fk" FOREIGN KEY ("bed_id","room_id") REFERENCES "public"."bed"("id","room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_bed_requires_room" CHECK ("tenant"."bed_id" is null or "tenant"."room_id" is not null);--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_bed_requires_active" CHECK ("tenant"."bed_id" is null or "tenant"."status" = 'active');--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      target.table_schema,
      target.table_name
    );
  END LOOP;
END $$;
