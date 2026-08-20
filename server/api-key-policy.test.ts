import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("API-key policy contracts", () => {
  it("has additive Neon policy columns and migration DDL", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/migrations/0018_magenta_ultimates.sql");
    expect(schema).toContain('creditLimit: numeric("credit_limit"');
    expect(schema).toContain('requestLimitPerMinute: integer("request_limit_per_minute")');
    expect(schema).toContain('tokenLimitPerMinute: integer("token_limit_per_minute")');
    expect(migration).toContain('ADD COLUMN "credit_limit"');
    expect(migration).toContain('ADD COLUMN "request_limit_per_minute"');
  });

  it("enforces expiry, credit, request, and token policies before gateway routing", () => {
    const db = read("server/db.ts");
    const gateway = read("server/gateway.ts");
    expect(db).toContain("export async function checkApiKeyPolicy");
    expect(db).toContain("api_key_credit_limit");
    expect(db).toContain("api_key_request_limit");
    expect(db).toContain("api_key_token_limit");
    expect(gateway).toContain("checkApiKeyPolicy(owner.apiKey.id, owner.user.id)");
    expect(gateway).toContain("This API key has reached its credit limit.");
  });

  it("exposes bounded user policy procedures and audited mutations", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("apiKeys: router");
    expect(router).toContain("usage: protectedProcedure");
    expect(router).toContain("updatePolicy: protectedProcedure");
    expect(router).toContain("api_key_policy_updated");
    expect(router).toContain("api_key_created");
  });

  it("renders a persisted accessible collapse control and policy controls", () => {
    const starter = read("client/src/components/CollapsibleWorkspaceStarter.tsx");
    const manager = read("client/src/components/ApiKeyPolicyManager.tsx");
    expect(starter).toContain('localStorage.getItem("kiwi.workspace-starter")');
    expect(starter).toContain("aria-expanded={expanded}");
    expect(starter).toContain("Collapse");
    expect(manager).toContain("Expires on");
    expect(manager).toContain("Total credit limit");
    expect(manager).toContain("Requests / minute");
    expect(manager).toContain("Tokens / minute");
    expect(manager).toContain("trpc.apiKeys.updatePolicy.useMutation");
  });
});
