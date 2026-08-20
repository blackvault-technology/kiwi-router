import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("founder operations application contracts", () => {
  it("mounts an isolated founder-only /ops route without the user dashboard shell", () => {
    const app = read("client/src/App.tsx");
    const ops = read("client/src/components/FounderOperationsApp.tsx");
    expect(app).toContain('location === "/ops"');
    expect(app).toContain("FounderOperationsApp");
    expect(ops).toContain('user.role !== "founder"');
    expect(ops).toContain("CloudHug Ops");
    expect(ops).toContain("Neon connected");
    expect(ops).not.toContain("<KiwiDashboard");
  });

  it("exposes the rebuilt command center and domain navigation", () => {
    const ops = read("client/src/components/FounderOperationsApp.tsx");
    expect(ops).toContain("Kiwi Router Admin");
    expect(ops).toContain('aria-label="Search admin sections"');
    expect(ops).toContain("Provider connections");
    expect(ops).toContain("Credentials & access");
    expect(ops).toContain("Model catalog");
    expect(ops).toContain("Routing & policy");
    expect(ops).toContain("Accounts & incidents");
    expect(ops).toContain("Credits & growth");
    expect(ops).toContain("Diagnostics & audit");
    expect(ops).toContain("Management control plane");
    expect(ops).toContain("Metric label=\"Providers\"");
    expect(ops).toContain("Metric label=\"Model routes\"");
  });

  it("keeps founder navigation usable while operations content scrolls", () => {
    const ops = read("client/src/components/FounderOperationsApp.tsx");
    expect(ops).toContain('lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]');
    expect(ops).toContain("lg:overflow-y-auto");
    expect(ops).toContain('aria-label="Founder admin sections"');
  });

  it("provides admin comfort and fast navigation controls", () => {
    const ops = read("client/src/components/FounderOperationsApp.tsx");
    expect(ops).toContain('kiwi-ops-theme');
    expect(ops).toContain('Switch to light mode');
    expect(ops).toContain('Switch to dark mode');
    expect(ops).toContain('Search admin sections');
    expect(ops).toContain('Loading admin control center');
    expect(ops).toContain('filteredNav.map');
  });

  it("uses a real model identity table and links existing provider routes", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/migrations/0017_curly_magneto.sql");
    const db = read("server/db.ts");
    expect(schema).toContain('pgTable("model_identities"');
    expect(schema).toContain("identityId");
    expect(migration).toContain('CREATE TABLE "model_identities"');
    expect(db).toContain("listModelIdentities");
    expect(db).toContain("identityId: identity.id");
  });

  it("exposes audited founder identity management and grouped route visibility", () => {
    const router = read("server/routers.ts");
    const panel = read("client/src/components/ModelIdentityRegistry.tsx");
    expect(router).toContain("modelIdentities: adminProcedure");
    expect(router).toContain("upsertModelIdentity: adminProcedure");
    expect(router).toContain("founder_model_identity_upserted");
    expect(panel).toContain("One Kiwi model ID, many provider routes");
    expect(panel).toContain("trpc.admin.modelIdentities.useQuery");
    expect(panel).toContain("providerName");
    expect(panel).toContain("enabledRouteCount");
  });
});
