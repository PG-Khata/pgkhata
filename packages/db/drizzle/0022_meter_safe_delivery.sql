ALTER TABLE "bill" ADD COLUMN "access_token" text;
UPDATE "bill" SET "access_token" = md5(random()::text || clock_timestamp()::text || id::text) WHERE "access_token" IS NULL;
ALTER TABLE "bill" ALTER COLUMN "access_token" SET NOT NULL;
ALTER TABLE "bill" ALTER COLUMN "access_token" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "bill" ADD CONSTRAINT "bill_access_token_unique" UNIQUE("access_token");
CREATE TABLE "bill_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bill_id" uuid NOT NULL REFERENCES "bill"("id") ON DELETE cascade,
  "channel" text NOT NULL, "kind" text NOT NULL DEFAULT 'bill', "status" text NOT NULL,
  "error" text, "provider_message_id" text, "created_at" timestamp DEFAULT now() NOT NULL
);
