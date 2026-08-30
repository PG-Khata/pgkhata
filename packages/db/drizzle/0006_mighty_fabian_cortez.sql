CREATE TABLE "rent_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"monthly_rent" integer NOT NULL,
	"security_deposit" integer,
	"due_day" integer DEFAULT 1 NOT NULL,
	"late_fee_per_day" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"min_stay_months" integer,
	"notice_period_days" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_plan_due_day_range" CHECK ("rent_plan"."due_day" between 1 and 28),
	CONSTRAINT "rent_plan_rent_nonnegative" CHECK ("rent_plan"."monthly_rent" >= 0),
	CONSTRAINT "rent_plan_late_fee_nonnegative" CHECK ("rent_plan"."late_fee_per_day" is null or "rent_plan"."late_fee_per_day" >= 0)
);
--> statement-breakpoint
ALTER TABLE "room" ADD COLUMN "rent_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "rent_plan" ADD CONSTRAINT "rent_plan_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rent_plan_property_name_uq" ON "rent_plan" USING btree ("property_id","name");--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_rent_plan_id_rent_plan_id_fk" FOREIGN KEY ("rent_plan_id") REFERENCES "public"."rent_plan"("id") ON DELETE restrict ON UPDATE no action;