import { describe, expect, it } from "vitest";

describe("Google OAuth credentials", () => {
  it("is accepted by Google’s token endpoint configuration check", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: "kiwi-configuration-check",
        redirect_uri: "https://kiwi-router.vercel.app/api/auth/google/callback",
        grant_type: "authorization_code",
      }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    expect(response.status).toBe(400);
    expect(body.error).not.toBe("invalid_client");
  }, 15_000);
});
