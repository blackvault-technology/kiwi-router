import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./googleAuth.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.ts", import.meta.url), "utf8");

describe("Google OAuth callback contract", () => {
  it("uses a signed expiring state and same-site httpOnly state cookie", () => {
    expect(source).toContain("new SignJWT");
    expect(source).toContain("setExpirationTime(`${STATE_TTL_SECONDS}s`)");
    expect(source).toContain('sameSite: "lax"');
    expect(source).toContain("httpOnly: true");
  });

  it("requires a verified Google email and links identity into Neon before starting a Kiwi session", () => {
    expect(source).toContain("profile.email_verified !== true");
    expect(source).toContain("upsertGoogleIdentity");
    expect(source).toContain("startSession(res, user)");
    expect(source).toContain('eventType: "google_login_success"');
    expect(source).toContain('res.redirect("/app")');
  });

  it("registers the callback behind the existing API security middleware", () => {
    expect(app.indexOf('app.use("/api", globalApiRateLimit)')).toBeLessThan(app.indexOf("registerGoogleAuth(app)"));
    expect(source).toContain('/api/auth/google/callback');
  });
});
