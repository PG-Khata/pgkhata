CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bill_month" text NOT NULL,
	"rent_amount" integer NOT NULL,
	"electricity_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"balance" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"room_number" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electricity_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"reading" integer NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"reading_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owner_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_date" timestamp NOT NULL,
	"method" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"electricity_mode" text DEFAULT 'flat' NOT NULL,
	"electricity_rate_per_unit" integer,
	"signup_token" text,
	"complaint_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_signup_token_unique" UNIQUE("signup_token"),
	CONSTRAINT "property_complaint_token_unique" UNIQUE("complaint_token")
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"number" text NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"monthly_rent" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joining_date" timestamp NOT NULL,
	"vacating_date" timestamp,
	"monthly_rent_override" integer,
	"deposit" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_reading" ADD CONSTRAINT "electricity_reading_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_profile" ADD CONSTRAINT "owner_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_owner_id_owner_profile_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;