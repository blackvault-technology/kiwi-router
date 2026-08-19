import { describe, expect, it } from "vitest";
import { assertSafeUpstreamUrl } from "./security";

describe("provider URL security", () => {
  it("accepts public HTTPS upstreams", () => {
    expect(assertSafeUpstreamUrl("https://api.openai.com/v1").hostname).toBe("api.openai.com");
  });

  it("rejects non-HTTPS and private-network upstreams", () => {
    expect(() => assertSafeUpstreamUrl("http://api.example.com")).toThrow();
    expect(() => assertSafeUpstreamUrl("https://127.0.0.1:8080")).toThrow();
    expect(() => assertSafeUpstreamUrl("https://localhost:3000")).toThrow();
  });
});
