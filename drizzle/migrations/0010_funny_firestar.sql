CREATE TABLE "rate_limit_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" varchar(24) NOT NULL,
	"subject" varchar(160) NOT NULL,
	"requests_per_minute" integer DEFAULT 30 NOT NULL,
	"tokens_per_minute" integer DEFAULT 10000 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_policies_scope_subject_idx" ON "rate_limit_policies" USING btree ("scope","subject");--> statement-breakpoint
CREATE INDEX "rate_limit_policies_scope_idx" ON "rate_limit_policies" USING btree ("scope");