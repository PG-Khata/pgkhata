-- Add police verification fields to tenant table
ALTER TABLE "tenant" ADD COLUMN "aadhaar_number" text;
ALTER TABLE "tenant" ADD COLUMN "pan_number" text;
ALTER TABLE "tenant" ADD COLUMN "permanent_address" text;
ALTER TABLE "tenant" ADD COLUMN "police_verification_status" text DEFAULT 'pending';
ALTER TABLE "tenant" ADD COLUMN "police_verification_date" timestamp;
ALTER TABLE "tenant" ADD COLUMN "police_verification_notes" text;
