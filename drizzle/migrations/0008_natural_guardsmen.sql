CREATE TABLE "api_key_provider_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" uuid NOT NULL,
	"provider_id" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_hint" varchar(16) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health_checks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"credential_id" integer,
	"ok" boolean NOT NULL,
	"status_code" integer,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"detail" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key_provider_access" ADD CONSTRAINT "api_key_provider_access_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_provider_access" ADD CONSTRAINT "api_key_provider_access_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_health_checks" ADD CONSTRAINT "provider_health_checks_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_health_checks" ADD CONSTRAINT "provider_health_checks_credential_id_provider_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_provider_access_key_provider_idx" ON "api_key_provider_access" USING btree ("api_key_id","provider_id");--> statement-breakpoint
CREATE INDEX "api_key_provider_access_provider_idx" ON "api_key_provider_access" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_provider_name_idx" ON "provider_credentials" USING btree ("provider_id","name");--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_idx" ON "provider_credentials" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "provider_health_checks_provider_created_idx" ON "provider_health_checks" USING btree ("provider_id","created_at");