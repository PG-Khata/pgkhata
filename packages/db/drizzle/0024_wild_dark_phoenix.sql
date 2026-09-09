CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "admin_document" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "admin_document" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "tenant_document" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "tenant_document" ADD COLUMN "content_type" text;--> statement-breakpoint
-- Accounts created before OTP verification was introduced remain usable. New
-- accounts are created unverified by Better Auth and must complete the OTP.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;--> statement-breakpoint
-- Recover private object keys from legacy R2 URLs. Unknown external URLs are
-- deliberately left without a key for the documented manual-review report.
UPDATE "admin_document"
SET "storage_key" = substring("file_url" from '(admin/[^?#]+)'),
    "content_type" = CASE
      WHEN lower("file_name") ~ '\\.pdf$' THEN 'application/pdf'
      WHEN lower("file_name") ~ '\\.(jpg|jpeg)$' THEN 'image/jpeg'
      WHEN lower("file_name") ~ '\\.png$' THEN 'image/png'
      ELSE NULL
    END
WHERE "file_url" ~ 'admin/[^?#]+';--> statement-breakpoint
UPDATE "tenant_document"
SET "storage_key" = substring("file_url" from '(kyc/[^?#]+)'),
    "content_type" = CASE
      WHEN lower("file_name") ~ '\\.pdf$' THEN 'application/pdf'
      WHEN lower("file_name") ~ '\\.(jpg|jpeg)$' THEN 'image/jpeg'
      WHEN lower("file_name") ~ '\\.png$' THEN 'image/png'
      ELSE NULL
    END
WHERE "file_url" ~ 'kyc/[^?#]+';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "storage_key" FROM "admin_document" WHERE "storage_key" IS NOT NULL
      UNION ALL
      SELECT "storage_key" FROM "tenant_document" WHERE "storage_key" IS NOT NULL
    ) keys GROUP BY "storage_key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate R2 storage keys must be resolved before migration 0024';
  END IF;
END $$;--> statement-breakpoint
UPDATE "admin_document" SET "file_url" = 'private' WHERE "storage_key" IS NOT NULL;--> statement-breakpoint
UPDATE "tenant_document" SET "file_url" = 'private' WHERE "storage_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_document" ADD CONSTRAINT "admin_document_storage_key_unique" UNIQUE("storage_key");--> statement-breakpoint
ALTER TABLE "tenant_document" ADD CONSTRAINT "tenant_document_storage_key_unique" UNIQUE("storage_key");
