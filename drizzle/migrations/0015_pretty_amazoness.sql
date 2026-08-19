DROP INDEX "models_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "models_slug_provider_upstream_idx" ON "models" USING btree ("slug","provider_id","upstream_id");--> statement-breakpoint
CREATE INDEX "models_slug_priority_idx" ON "models" USING btree ("slug");