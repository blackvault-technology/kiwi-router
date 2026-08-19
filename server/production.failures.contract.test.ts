import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/migrations/0012_concerned_zeigeist.sql", import.meta.url), "utf8");

describe("production API failure repairs", () => {
  it("keeps the API-key expiry column in the schema and additive migration", () => {
    expect(schema).toContain('expiresAt: timestamp("expires_at", { withTimezone: true })');
    expect(migration).toContain('ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;');
    expect(db).toContain("apiKeys.expiresAt");
  });

  it("casts admin security-event IDs to JSON-safe text", () => {
    expect(db).toContain('SELECT id::text AS id, event_type AS "eventType"');
  });
});
