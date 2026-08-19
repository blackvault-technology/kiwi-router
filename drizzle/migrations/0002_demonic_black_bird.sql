CREATE TYPE "public"."ban_scope" AS ENUM('user', 'ip', 'email_domain');--> statement-breakpoint
CREATE TYPE "public"."credit_bucket" AS ENUM('stipend', 'purchased');--> statement-breakpoint
CREATE TYPE "public"."credit_entry_type" AS ENUM('grant', 'airdrop', 'purchase', 'spend', 'expiry');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'founder';--> statement-breakpoint
CREATE TABLE "access_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" "ban_scope" NOT NULL,
	"value" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"kind" varchar(24) DEFAULT 'notice' NOT NULL,
	"credits_per_user" numeric(14, 3) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(14, 3) NOT NULL,
	"entry_type" "credit_entry_type" NOT NULL,
	"bucket" "credit_bucket" NOT NULL,
	"description" text NOT NULL,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"stripe_payment_intent_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(64),
	"user_agent_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_settings" ALTER COLUMN "requests_per_minute" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "credit_cost_per_1k_tokens" numeric(12, 3) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_settings" ADD COLUMN "ip_requests_per_minute" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_settings" ADD COLUMN "global_api_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "credits_deducted" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "user_agent_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stipend_credits" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "purchased_credits" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "access_bans" ADD CONSTRAINT "access_bans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_records" ADD CONSTRAINT "login_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_bans_scope_value_idx" ON "access_bans" USING btree ("scope","value");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_expiry_idx" ON "credit_ledger" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "login_records_user_created_idx" ON "login_records" USING btree ("user_id","created_at");