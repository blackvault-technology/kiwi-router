import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const gateway = readFileSync(new URL("./gateway.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/migrations/0012_concerned_zeigeist.sql", import.meta.url), "utf8");

describe("production API failure repairs", () => {
  it("keeps the API-key expiry column in the schema and additive migration", () => {
    expect(schema).toContain('expiresAt: timestamp("expires_at", { withTimezone: true })');
    expect(migration).toContain('ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;');
    expect(db).toContain("apiKeys.expiresAt");
  });

  it("casts admin security-event IDs to JSON-safe text", () => {
    expect(db).toContain('id: sql<string>`${securityEvents.id}::text`');
    expect(db).toContain('eventType: securityEvents.eventType');
  });

  it("fails over across provider routes and returns a stable JSON error on upstream failure", () => {
    expect(gateway).toContain("async function requestUpstream(routes: GatewayRoute[]");
    expect(gateway).toContain("Upstream returned HTTP ${response.status}");
    expect(gateway).toContain('"The configured provider routes could not complete this request. Please retry shortly."');
    expect(gateway).toContain('"upstream_error"');
  });
});
