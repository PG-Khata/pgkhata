ALTER TABLE "bill" ADD COLUMN "rent_period_start" date;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "rent_period_end" date;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "rent_cycle_mode" text;--> statement-breakpoint
ALTER TABLE "billing_policy" ADD COLUMN "rent_cycle_mode" text DEFAULT 'calendar_month' NOT NULL;--> statement-breakpoint
INSERT INTO "billing_policy" ("property_id")
SELECT "id" FROM "property"
ON CONFLICT ("property_id") DO NOTHING;--> statement-breakpoint
UPDATE "bill" AS "b"
SET
	"rent_period_start" = CASE
		WHEN "t"."joining_date" < (to_date("b"."bill_month" || '-01', 'YYYY-MM-DD') + interval '1 month')::date
			THEN GREATEST(to_date("b"."bill_month" || '-01', 'YYYY-MM-DD'), "t"."joining_date")
		ELSE to_date("b"."bill_month" || '-01', 'YYYY-MM-DD')
	END,
	"rent_period_end" = (to_date("b"."bill_month" || '-01', 'YYYY-MM-DD') + interval '1 month')::date,
	"rent_cycle_mode" = 'calendar_month'
FROM "tenant" AS "t"
WHERE "t"."id" = "b"."tenant_id";--> statement-breakpoint
-- Meter mode without a positive unit rate never produced a valid electricity
-- charge. Preserve billing availability by treating those legacy rows as flat.
UPDATE "property"
SET "electricity_mode" = 'flat', "electricity_rate_per_unit" = NULL
WHERE "electricity_mode" = 'meter'
  AND ("electricity_rate_per_unit" IS NULL OR "electricity_rate_per_unit" <= 0);--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_rent_cycle_mode_check" CHECK ("bill"."rent_cycle_mode" is null or "bill"."rent_cycle_mode" in ('calendar_month', 'joining_anniversary'));--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_rent_period_complete" CHECK (("bill"."rent_period_start" is null and "bill"."rent_period_end" is null and "bill"."rent_cycle_mode" is null) or ("bill"."rent_period_start" is not null and "bill"."rent_period_end" > "bill"."rent_period_start" and "bill"."rent_cycle_mode" is not null));--> statement-breakpoint
ALTER TABLE "billing_policy" ADD CONSTRAINT "billing_policy_rent_cycle_mode_check" CHECK ("billing_policy"."rent_cycle_mode" in ('calendar_month', 'joining_anniversary'));--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_electricity_mode_check" CHECK ("property"."electricity_mode" in ('flat', 'meter'));--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_meter_rate_required" CHECK ("property"."electricity_mode" <> 'meter' or "property"."electricity_rate_per_unit" > 0);
