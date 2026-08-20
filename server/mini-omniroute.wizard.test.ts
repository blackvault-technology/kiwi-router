import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(new URL("../client/src/components/MiniOmniRouteWizard.tsx", import.meta.url), "utf8");
const founder = readFileSync(new URL("../client/src/components/FounderControlCenter.tsx", import.meta.url), "utf8");

describe("Mini OmniRoute founder setup", () => {
  it("exposes the guided five-step setup sequence", () => {
    expect(wizard).toContain('["Provider", "Credential", "Models", "Route", "Publish"]');
    expect(wizard).toContain("Connect one model, then add failover providers");
    expect(wizard).toContain("Credentials are encrypted and never shown again.");
  });

  it("guards provider and route inputs with friendly normalized validation", () => {
    expect(wizard).toContain("normalizeBaseUrl");
    expect(wizard).toContain("providerErrors");
    expect(wizard).toContain("routeErrors");
    expect(wizard).toContain("validationMessage");
    expect(wizard).toContain("Provider name must be at least 2 characters.");
    expect(wizard).toContain("Base URL must use HTTPS.");
  });

  it("connects provider, credential validation, discovery, route testing, and publish mutations", () => {
    expect(wizard).toContain("trpc.admin.saveProvider.useMutation");
    expect(wizard).toContain("trpc.admin.testProviderConnection.useMutation");
    expect(wizard).toContain("trpc.admin.saveProviderCredential.useMutation");
    expect(wizard).toContain("trpc.admin.syncProviderModels.useMutation");
    expect(wizard).toContain("trpc.admin.testModelRoute.useMutation");
    expect(wizard).toContain("trpc.admin.updateModel.useMutation");
    expect(wizard).toContain("priority");
  });

  it("is mounted above the advanced provider controls", () => {
    expect(founder).toContain("<MiniOmniRouteWizard />");
    expect(founder).toContain("<ProviderOperations providers={providers} />");
  });
});
