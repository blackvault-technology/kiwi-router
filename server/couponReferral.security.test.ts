import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateReferralCode, normalizeCouponCode } from "./db";

describe("coupon and referral safeguards", () => {
  it("normalizes coupon codes and generates share-safe referral codes", () => {
    expect(normalizeCouponCode("  spring_25  ")).toBe("SPRING_25");
    const codes = new Set(Array.from({ length: 32 }, () => generateReferralCode()));
    expect(codes.size).toBe(32);
    for (const code of codes) expect(code).toMatch(/^KR[A-Z0-9]{18}$/);
  });

  it("keeps one-per-user and one-per-network coupon constraints in the PostgreSQL schema", () => {
    const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('uniqueIndex("coupon_redemptions_coupon_user_idx")');
    expect(schema).toContain('uniqueIndex("coupon_redemptions_coupon_ip_idx")');
  });

  it("enforces referral uniqueness per user, signup IP, and device signal", () => {
    const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('uniqueIndex("referrals_referred_user_idx")');
    expect(schema).toContain('uniqueIndex("referrals_signup_ip_idx")');
    expect(schema).toContain('uniqueIndex("referrals_device_idx")');
  });
});
