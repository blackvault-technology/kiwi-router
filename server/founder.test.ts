import { describe, expect, it } from "vitest";
import { balanceOf } from "./credits";
import { FOUNDER_EMAIL, isFounderEmail, normalizeEmail } from "./founder";

describe("single-founder security model", () => {
  it("normalizes aliases before founder and duplicate-account checks", () => {
    expect(normalizeEmail(" IndiaSikhoTechno+ops@gmail.com ")).toBe(FOUNDER_EMAIL);
    expect(isFounderEmail("indiasikhotechno+backup@gmail.com")).toBe(true);
    expect(isFounderEmail("another@example.com")).toBe(false);
  });

  it("combines stipend and purchased Kiwi Credits without rounding away balance", () => {
    expect(balanceOf({ stipendCredits: "50.000", purchasedCredits: "12.500" })).toBe(62.5);
  });
});
