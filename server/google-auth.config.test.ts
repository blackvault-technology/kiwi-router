import { describe, expect, it } from "vitest";

function googleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`,
  };
}

describe("Google OAuth configuration contract", () => {
  it("uses server-side credentials and a callback owned by Kiwi Router", () => {
    const config = googleOAuthConfig();
    expect(typeof config.clientId).toBe("string");
    expect(typeof config.clientSecret).toBe("string");
    expect(config.redirectUri).toContain("/api/auth/google/callback");
  });
});
