import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../client/src/components/DeepManagementWorkspace.tsx", import.meta.url), "utf8");

describe("provider model sync safety contract", () => {
  it("bounds upstream discovery and returns structured failure metadata", () => {
    expect(dbSource).toContain("const controller = new AbortController();");
    expect(dbSource).toContain("setTimeout(() => controller.abort(), 8_000)");
    expect(dbSource).toContain("detail: \"Provider rejected model discovery\"");
    expect(dbSource).toContain("detail: \"Provider did not complete model discovery\"");
    expect(dbSource).toContain("isHealthy: false");
    expect(dbSource).toContain("Array.isArray(payload.data)");
  });

  it("audits sync outcomes without exposing upstream secrets", () => {
    expect(routerSource).toContain('eventType: "founder_provider_sync"');
    expect(routerSource).toContain("ok: result.ok");
    expect(routerSource).toContain("statusCode: result.statusCode");
    expect(routerSource).not.toContain("decryptSecret(provider.encryptedApiKey)");
  });

  it("renders a failure toast instead of claiming a failed sync succeeded", () => {
    expect(uiSource).toContain("if (!result.ok)");
    expect(uiSource).toContain("toast.error(result.detail)");
  });
});
