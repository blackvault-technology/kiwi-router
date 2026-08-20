CREATE TABLE "model_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "identity_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "model_identities_slug_idx" ON "model_identities" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_identity_id_model_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."model_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "models_identity_idx" ON "models" USING btree ("identity_id");