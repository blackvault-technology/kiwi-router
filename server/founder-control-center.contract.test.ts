import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const dashboard = fs.readFileSync(path.join(root, "client/src/components/KiwiDashboard.tsx"), "utf8");
const consoleSource = fs.readFileSync(path.join(root, "client/src/components/FounderControlCenter.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const database = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");

describe("founder control-center contract", () => {
  it("keeps the founder console role-gated and outside the standard user navigation", () => {
    expect(dashboard).toContain('item.label !== "Admin" || user.role === "founder"');
    expect(dashboard).toContain('location === "/app/admin" && user.role === "founder" ? <FounderControlCenter />');
    expect(dashboard).toContain('item.label === "Admin" ? "Founder Console" : item.label');
    expect(dashboard).toContain('if (user.role === "founder") return null;');
    expect(dashboard).toContain("Your developer workspace");
    expect(dashboard).toContain('onNavigate("/app/api-keys")');
    expect(dashboard).toContain('onNavigate("/app/playground")');
  });

  it("preserves management sections for operations, upstream connections, routes, access safety, and growth programs", () => {
    for (const section of ["Operations", "Providers", "Model registry", "Access & safety", "Growth"]) expect(consoleSource).toContain(section);
    for (const control of ["Connect a provider", "Test", "Sync models", "Archive", "Gateway rate limits", "User security", "Coupon program", "Announcements"]) expect(consoleSource).toContain(control);
    expect(consoleSource).toContain("Edit selected route");
    expect(consoleSource).toContain("Changing the upstream ID is a material routing change and requires confirmation.");
    expect(consoleSource).toContain("Enable\" : \"Disable\"");
    expect(consoleSource).toContain("for gateway routing?");
  });

  it("provides fast management filters for providers and model routes", () => {
    expect(consoleSource).toContain('aria-label="Filter providers"');
    expect(consoleSource).toContain('aria-label="Filter model routes"');
    expect(consoleSource).toContain("filteredProviders.map");
    expect(consoleSource).toContain("filteredModels.map");
    expect(consoleSource).toContain("Showing ${filteredModels.length} of ${models.length} routes");
    expect(consoleSource).toContain("No model routes match this filter.");
  });

  it("prevents invalid provider and model mutations with friendly guidance", () => {
    expect(consoleSource).toContain("normalizeBaseUrl");
    expect(consoleSource).toContain("providerValidation");
    expect(consoleSource).toContain("modelValidation");
    expect(consoleSource).toContain("Provider name must be at least 2 characters.");
    expect(consoleSource).toContain("Enter a valid provider URL");
    expect(consoleSource).toContain("validationMessage");
    expect(consoleSource).toContain("baseUrl: normalizedUrl");
  });

  it("applies consistent validation across admin management domains", () => {
    expect(consoleSource).toContain("Scope subject must be at least 2 characters.");
    expect(consoleSource).toContain("Credential profile name must be at least 2 characters.");
    expect(consoleSource).toContain("Enter a valid account email.");
    expect(consoleSource).toContain("Coupon code must be 3–48 letters");
    expect(consoleSource).toContain("Announcement must be at least 2 characters.");
    expect(consoleSource).not.toContain("onError: error => toast.error(error.message)");
  });

  it("keeps the simplified guided-first information architecture", () => {
    expect(consoleSource).toContain("Recommended next move");
    expect(consoleSource).toContain("Advanced gateway safety policies");
    expect(consoleSource).toContain("Advanced provider inventory, credentials, and access");
    expect(consoleSource).toContain("Advanced diagnostics and audit explorer");
    expect(consoleSource).toContain("Use the guided provider flow for new connections");
  });

  it("exposes audited founder-only procedures for safe connection tests and non-destructive archival", () => {
    expect(router).toContain("testProviderConnection: adminProcedure");
    expect(router).toContain("archiveProvider: adminProcedure");
    expect(router).toContain("archiveModel: adminProcedure");
    expect(router).toContain('eventType: "founder_provider_test"');
    expect(router).toContain('eventType: "founder_provider_archived"');
    expect(router).toContain('eventType: "founder_model_archived"');
  });

  it("records safe management audit events without persisting provider credentials in event metadata", () => {
    for (const event of ["founder_provider_saved", "founder_provider_sync", "founder_provider_test", "founder_model_created", "founder_model_updated", "founder_model_archived", "founder_gateway_switch", "founder_rate_limits_saved"]) expect(router).toContain(`eventType: "${event}"`);
    expect(router).toContain("credentialChanged: Boolean(input.apiKey)");
    expect(router).not.toContain("metadata: { apiKey:");
  });

  it("uses documented archival rather than destructive record deletion for provider and model retirement", () => {
    expect(database).toContain("Archives a provider safely by disabling it and every attached route without deleting audit history.");
    expect(database).toContain("Archives a model route by disabling it, retaining its historic usage and ledger references.");
    expect(database).toContain("set({ isEnabled: false");
    expect(database).not.toContain("delete(providers)");
    expect(database).not.toContain("delete(models)");
  });

  it("explains safe archival in the founder-facing control center", () => {
    expect(consoleSource).toContain("safely retire encrypted provider connections");
    expect(consoleSource).toContain("historical usage and ledgers remain preserved");
    expect(consoleSource).toContain("Retire");
  });
});
