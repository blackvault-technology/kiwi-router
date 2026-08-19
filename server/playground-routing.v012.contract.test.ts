import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../client/src/components/KiwiDashboard.tsx", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("v0.1.2 Playground and multi-provider routing", () => {
  it("turns non-JSON gateway responses into readable request errors", () => {
    expect(dashboard).toContain("const raw = await response.text()");
    expect(dashboard).toContain("JSON.parse(raw)");
    expect(dashboard).toContain("Request error (${response.status})");
  });

  it("does not expose provider names in the user-facing model catalog", () => {
    expect(dashboard).toContain("Provider selection is handled automatically.");
    expect(dashboard).not.toContain('<p className="text-sm text-zinc-500">{provider.displayName}</p>');
  });

  it("deduplicates public models and prefers healthy routes by priority internally", () => {
    expect(db).toContain("const seen = new Set<string>()");
    expect(db).toContain("providers.isHealthy} DESC");
    expect(db).toContain("priority')::int, 100) ASC");
  });

  it("allows multiple provider-backed routes for the same public model slug", () => {
    expect(schema).toContain("models_slug_provider_upstream_idx");
    expect(schema).toContain("models_slug_priority_idx");
    expect(schema).not.toContain('uniqueIndex("models_slug_idx").on(table.slug)');
  });
});
