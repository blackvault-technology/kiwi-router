import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const docsSource = readFileSync(new URL("../client/src/pages/DocsV2.tsx", import.meta.url), "utf8");
const landingSource = readFileSync(new URL("../client/src/pages/LandingV2.tsx", import.meta.url), "utf8");

describe("public legal routes and production documentation", () => {
  it("publishes every required legal route without requiring an authenticated session", () => {
    for (const route of ["/terms", "/privacy", "/acceptable-use", "/cookies"]) {
      expect(appSource).toContain(`location === "${route}"`);
      expect(appSource).toContain(`if (location === "${route}")`);
    }
  });

  it("uses canonical production gateway URLs and documents the coupon-referral program", () => {
    expect(docsSource).toContain("https://kiwi-router.vercel.app");
    expect(docsSource).toContain("/api/v1/chat/completions");
    expect(docsSource).toContain("/api/v1/models");
    expect(docsSource).toContain("Coupon redemption");
    expect(docsSource).toContain("Referral program");
  });

  it("links the complete legal-policy set from the public landing footer", () => {
    for (const route of ["/terms", "/privacy", "/acceptable-use", "/cookies"]) expect(landingSource).toContain(`href="${route}"`);
  });
});
