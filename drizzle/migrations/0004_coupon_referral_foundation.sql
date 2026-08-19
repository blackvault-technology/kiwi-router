CREATE TYPE "public"."referral_status" AS ENUM('pending', 'activated', 'rejected');--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"credits_amount" numeric(14, 3) NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"ledger_entry_id" bigint,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"referrer_user_id" integer NOT NULL,
	"referred_user_id" integer NOT NULL,
	"referral_code" varchar(32) NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"signup_ip_hash" varchar(64) NOT NULL,
	"device_hash" varchar(64),
	"referrer_reward_credits" numeric(14, 3) DEFAULT '0' NOT NULL,
	"referred_reward_credits" numeric(14, 3) DEFAULT '0' NOT NULL,
	"activated_at" timestamp with time zone,
	"referrer_reward_claimed_at" timestamp with time zone,
	"referred_reward_claimed_at" timestamp with time zone,
	"referrer_ledger_entry_id" bigint,
	"referred_ledger_entry_id" bigint,
	"rejection_reason" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar(32);--> statement-breakpoint
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupon_codes_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_ledger_entry_id_credit_ledger_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."credit_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_ledger_entry_id_credit_ledger_id_fk" FOREIGN KEY ("referrer_ledger_entry_id") REFERENCES "public"."credit_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_ledger_entry_id_credit_ledger_id_fk" FOREIGN KEY ("referred_ledger_entry_id") REFERENCES "public"."credit_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_codes_code_idx" ON "coupon_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupon_codes_active_expiry_idx" ON "coupon_codes" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_coupon_user_idx" ON "coupon_redemptions" USING btree ("coupon_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_coupon_ip_idx" ON "coupon_redemptions" USING btree ("coupon_id","ip_hash");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_user_created_idx" ON "coupon_redemptions" USING btree ("user_id","redeemed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_user_idx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_status_idx" ON "referrals" USING btree ("referrer_user_id","status");--> statement-breakpoint
CREATE INDEX "referrals_referral_code_idx" ON "referrals" USING btree ("referral_code");
