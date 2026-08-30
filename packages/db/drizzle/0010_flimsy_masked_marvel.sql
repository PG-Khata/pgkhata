CREATE TABLE "security_deposit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"refund_amount" integer DEFAULT 0 NOT NULL,
	"refund_date" timestamp,
	"promised_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "security_deposit_amount_positive" CHECK ("security_deposit"."amount" > 0),
	CONSTRAINT "security_deposit_refund_within_amount" CHECK ("security_deposit"."refund_amount" >= 0 and "security_deposit"."refund_amount" <= "security_deposit"."amount")
);
--> statement-breakpoint
ALTER TABLE "security_deposit" ADD CONSTRAINT "security_deposit_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_deposit" ADD CONSTRAINT "security_deposit_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE restrict ON UPDATE no action;