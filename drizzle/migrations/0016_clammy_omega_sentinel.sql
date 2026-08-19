CREATE TABLE "auto_route_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(120) DEFAULT 'kiwi/auto' NOT NULL,
	"display_name" varchar(120) DEFAULT 'Kiwi Auto Model' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"max_cost_per_1k" numeric(12, 3) DEFAULT '1000' NOT NULL,
	"latency_budget_ms" integer DEFAULT 45000 NOT NULL,
	"min_context_window" integer DEFAULT 4096 NOT NULL,
	"require_healthy" boolean DEFAULT true NOT NULL,
	"fallback_on_5xx" boolean DEFAULT true NOT NULL,
	"fallback_on_timeout" boolean DEFAULT true NOT NULL,
	"routing_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_route_policies" ADD CONSTRAINT "auto_route_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auto_route_policies_slug_idx" ON "auto_route_policies" USING btree ("slug");