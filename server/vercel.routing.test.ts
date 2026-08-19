import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel production routing", () => {
  it("routes API requests to the serverless handler before using the SPA fallback", () => {
    const configPath = path.resolve(import.meta.dirname, "..", "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      outputDirectory?: string;
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(config.outputDirectory).toBe("dist");
    expect(config.rewrites).toEqual([
      { source: "/api/(.*)", destination: "/api/[...path]" },
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });
});
