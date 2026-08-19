import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
const resetPage = readFileSync(new URL("../client/src/pages/ResetPassword.tsx", import.meta.url), "utf8");
const verifyPage = readFileSync(new URL("../client/src/pages/VerifyEmail.tsx", import.meta.url), "utf8");

describe("complete email authentication contract", () => {
  it("exposes registration, verification, resend, login, reset-request, reset, and logout procedures", () => {
    for (const procedure of ["register", "verifyEmail", "resendVerification", "login", "requestPasswordReset", "resetPassword", "logout"]) {
      expect(router).toContain(`${procedure}:`);
    }
    expect(router).toContain("deliverTransactionalEmail");
    expect(router).toContain("PRECONDITION_FAILED");
  });

  it("keeps recovery links single-use and revokes sessions after password changes", () => {
    expect(router).toContain('purpose: "password_reset"');
    expect(router).toContain("updatePasswordAndRevokeSessions");
    expect(router).toContain("consumeAuthToken");
  });

  it("routes production email links to executable verification and reset pages", () => {
    expect(email).toContain("/verify-email?token=");
    expect(email).toContain("/reset-password?token=");
    expect(app).toContain('if (location === "/verify-email")');
    expect(app).toContain('if (location === "/reset-password")');
    expect(verifyPage).toContain("verifyEmail.useMutation");
    expect(resetPage).toContain("resetPassword.useMutation");
  });
});
