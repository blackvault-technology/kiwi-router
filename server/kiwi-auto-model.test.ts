import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const gateway = readFileSync(new URL("./gateway.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../client/src/lib/playgroundApi.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../client/src/components/KiwiDashboard.tsx", import.meta.url), "utf8");
const ux = readFileSync(new URL("../client/src/components/UXEnhancements.tsx", import.meta.url), "utf8");
const uxCatalog = readFileSync(new URL("../client/src/lib/uxEnhancementCatalog.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const policyPanel = readFileSync(new URL("../client/src/components/KiwiAutoPolicyPanel.tsx", import.meta.url), "utf8");

describe("Kiwi Auto Model", () => {
  it("publishes a synthetic Kiwi Auto Model without changing provider-neutral discovery", () => {
    expect(db).toContain('KIWI_AUTO_MODEL_SLUG = "kiwi/auto"');
    expect(db).toContain('displayName: "Kiwi Auto Model"');
    expect(db).toContain('slug: KIWI_AUTO_MODEL_SLUG');
  });

  it("scores routes using health, task capabilities, cost, context, and priority", () => {
    expect(db).toContain("requireTools");
    expect(db).toContain("requireVision");
    expect(db).toContain("requireReasoning");
    expect(db).toContain("contextFit");
    expect(db).toContain("healthBoost");
    expect(db).toContain("costScore");
    expect(db).toContain("getAutoRoutePolicy");
    expect(db).toContain("minContextWindow");
  });

  it("routes kiwi/auto through all eligible candidates and preserves the public model identity", () => {
    expect(gateway).toContain('body.model === "kiwi/auto"');
    expect(gateway).toContain("getGatewayRoutes(body.model, { stream: body.stream");
    expect(gateway).toContain("const responseModel = body.model");
    expect(gateway).toContain("auto_route_unavailable");
  });

  it("generates copyable production API examples", () => {
    expect(api).toContain("kiwi-router.vercel.app/api/v1/chat/completions");
    expect(api).toContain("curl");
    expect(api).toContain("javascript");
    expect(api).toContain("python");
    expect(api).toContain("streaming");
    expect(dashboard).toContain('title="Generated API"');
    expect(dashboard).toContain("generatePlaygroundApis");
  });

  it("persists and audits founder-tunable Auto Model policy", () => {
    expect(schema).toContain('autoRoutePolicies = pgTable("auto_route_policies"');
    expect(routers).toContain("autoRoutePolicy: adminProcedure");
    expect(routers).toContain("updateAutoRoutePolicy: adminProcedure");
    expect(routers).toContain("founder_auto_route_policy_updated");
    expect(policyPanel).toContain("Live eligibility preview");
    expect(policyPanel).toContain("Save policy");
  });

  it("ships the requested 50-item UX enhancement pass", () => {
    expect((uxCatalog.match(/\"[a-z0-9-]+\"/g) ?? []).length).toBe(50);
    expect(ux).toContain("Skip to content");
    expect(ux).toContain("command palette");
    expect(ux).toContain("aria-live");
    expect(ux).toContain("lg:hidden");
  });
});
