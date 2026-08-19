import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";
import { decryptSecret, encryptSecret } from "./crypto";

describe("custom authentication security", () => {
  it("hashes a password with a salt and verifies only the correct password", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");

    expect(passwordHash).not.toContain("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("encrypts provider credentials with authenticated encryption", () => {
    const secret = "sk-upstream-example";
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });
});
