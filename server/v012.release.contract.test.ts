import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gateway = readFileSync(new URL("./gateway.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

describe("Kiwi Router v0.1.2 release contract", () => {
  it("identifies the release as v0.1.2", () => {
    expect(packageJson.version).toBe("0.1.2");
  });

  it("parallelizes independent access-ban and rate-limit checks", () => {
    expect(gateway).toContain("Promise.all([isAccessBanned");
    expect(gateway).toContain("checkRateLimit(owner.user.id, ipAddress)");
  });

  it("keeps the OpenAI-compatible completion endpoint and safe upstream timeout", () => {
    expect(gateway).toContain('app.post("/api/v1/chat/completions"');
    expect(gateway).toContain("AbortController");
    expect(gateway).toContain("signal: controller.signal");
  });
});
