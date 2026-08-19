import { describe, expect, it } from "vitest";
import { founderBootstrapConfigured } from "./founderBootstrap";

describe("founder bootstrap configuration", () => {
  it("makes the supplied founder bootstrap secret available to the server initialization path", () => {
    expect(founderBootstrapConfigured()).toBe(true);
  });
});
