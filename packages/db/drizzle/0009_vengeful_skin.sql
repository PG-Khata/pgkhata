CREATE TABLE "advance_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"applied_amount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "advance_payment_amount_positive" CHECK ("advance_payment"."amount" > 0),
	CONSTRAINT "advance_payment_applied_within_amount" CHECK ("advance_payment"."applied_amount" >= 0 and "advance_payment"."applied_amount" <= "advance_payment"."amount")
);
--> statement-breakpoint
ALTER TABLE "advance_payment" ADD CONSTRAINT "advance_payment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;