ALTER TABLE "property" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "landmark" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "alternate_phone" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "occupation" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "date_of_birth" timestamp;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "aadhaar_number" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "pan_number" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "permanent_address" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "permanent_address_city" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "permanent_address_state" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "permanent_address_pincode" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "police_verification_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "police_verification_date" timestamp;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "police_verification_notes" text;