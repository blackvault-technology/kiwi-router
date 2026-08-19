import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = new URL("./googleAuth.ts", import.meta.url);

describe("Google OAuth runtime configuration", () => {
  it("reads only server-side Google credentials and uses the production callback", async () => {
    const code = readFileSync(source, "utf8");
    expect(code).toContain("process.env.GOOGLE_CLIENT_ID");
    expect(code).toContain("process.env.GOOGLE_CLIENT_SECRET");
    expect(code).toContain("/api/auth/google/callback");
    expect(code).toContain("process.env.APP_URL");
    expect(code).toContain("Google sign-in is not configured");
  });
});
