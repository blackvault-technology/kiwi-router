import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production analytics entry", () => {
  it("does not emit an Umami request when no analytics endpoint is configured", () => {
    const entry = fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "index.html"), "utf8");

    expect(entry).not.toContain("VITE_ANALYTICS_ENDPOINT");
    expect(entry).not.toContain("/umami");
  });
});
