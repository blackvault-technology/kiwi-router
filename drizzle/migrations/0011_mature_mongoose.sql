ALTER TABLE "providers" ADD COLUMN "protocol" varchar(24) DEFAULT 'openai' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "request_headers" jsonb DEFAULT '{}'::jsonb NOT NULL;