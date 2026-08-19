import { describe, expect, it } from "vitest";
import { hashApiKey } from "./auth";

describe("gateway key security", () => {
  it("produces stable SHA-256 hashes without retaining the raw key", () => {
    const key = "kiwi_sk_example_secret";
    expect(hashApiKey(key)).toHaveLength(64);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toContain(key);
  });
});
