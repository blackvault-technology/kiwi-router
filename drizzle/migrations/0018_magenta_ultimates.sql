ALTER TABLE "api_keys" ADD COLUMN "credit_limit" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "request_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "token_limit_per_minute" integer;