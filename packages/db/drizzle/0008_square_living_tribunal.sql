ALTER TABLE "bill" ADD COLUMN "line_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_amounts_nonnegative" CHECK ("bill"."total_amount" >= 0 and "bill"."paid_amount" >= 0);