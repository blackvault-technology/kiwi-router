import { describe, expect, it } from "vitest";
import { creditsForTokens } from "./credits";
import { getCreditPack } from "./creditPacks";

describe("Kiwi Credit calculations", () => {
  it("rounds a model charge up from reported input and output tokens", () => {
    expect(creditsForTokens(1, 400, 600)).toBe(1);
    expect(creditsForTokens(5, 1100, 120)).toBe(7);
  });

  it("uses a valid one-time pack with non-trivial Stripe amount", () => {
    expect(getCreditPack("sprout")).toMatchObject({ credits: 500, unitAmount: 500 });
    expect(() => getCreditPack("unknown")).toThrow("Unknown Kiwi Credit pack");
  });
});
