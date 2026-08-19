import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../client/src/components/FounderControlCenter.tsx", import.meta.url), "utf8");

describe("deep founder console contracts", () => {
  it("defines provider credentials, health history, and provider-scoped key access", () => {
    expect(schema).toContain('pgTable("provider_credentials"');
    expect(schema).toContain('pgTable("provider_health_checks"');
    expect(schema).toContain('pgTable("api_key_provider_access"');
    expect(db).toContain("listProviderCredentials");
    expect(db).toContain("testProviderCredential");
    expect(db).toContain("listProviderHealth");
    expect(db).toContain("setApiKeyProviderAccess");
  });

  it("keeps sensitive credential operations founder-only and audited", () => {
    expect(router).toContain("providerCredentials: adminProcedure");
    expect(router).toContain("saveProviderCredential: adminProcedure");
    expect(router).toContain("testProviderCredential: adminProcedure");
    expect(router).toContain('eventType: "founder_provider_credential_created"');
    expect(router).toContain('eventType: "founder_provider_credential_tested"');
    expect(router).not.toContain("return input.apiKey");
  });

  it("exposes responsive founder controls for credentials, health, and provider key inventory", () => {
    expect(ui).toContain("Credential profiles & provider controls");
    expect(ui).toContain("Health history");
    expect(ui).toContain("Provider-scoped API-key inventory");
    expect(ui).toContain("Rotate credentials without exposing secrets");
  });

  it("exposes founder user intelligence and redacted observability controls", () => {
    expect(router).toContain("userSessions: adminProcedure");
    expect(router).toContain("revokeUserApiKeys: adminProcedure");
    expect(router).toContain("userUsage: adminProcedure");
    expect(router).toContain("userLedger: adminProcedure");
    expect(router).toContain("auditEvents: adminProcedure");
    expect(ui).toContain("User intelligence & incident response");
    expect(ui).toContain("Gateway diagnostics & audit explorer");
    expect(ui).toContain("Revoke sessions");
    expect(ui).toContain("Revoke API keys");
    expect(router).toContain("rateLimitPolicies: adminProcedure");
    expect(router).toContain("adjustUserCredits: adminProcedure");
    expect(ui).toContain("Scoped rate-limit policy presets");
    expect(ui).toContain("Provider uptime");
  });
});

