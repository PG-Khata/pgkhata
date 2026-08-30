CREATE TABLE "charge_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"default_amount" integer DEFAULT 0 NOT NULL,
	"is_recurring" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "charge_type_amount_nonnegative" CHECK ("charge_type"."default_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "charge_type" ADD CONSTRAINT "charge_type_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charge_type_property_code_uq" ON "charge_type" USING btree ("property_id","code");