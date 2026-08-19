import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CloudHug landing experience", () => {
  it("ships the Kiwi Router hero with a CloudHug badge and provider rail", () => {
    const entry = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", "LandingV2.tsx"), "utf8");

    expect(entry).toContain("CloudHug");
    expect(entry).toContain("Route every model.");
    expect(entry).toContain("ProviderRail");
    expect(entry).toContain("OpenAI");
  });
});
