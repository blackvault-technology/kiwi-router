import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel handler bundling", () => {
  it("keeps Vite-only setup out of the shared production app factory", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const appSource = fs.readFileSync(path.join(root, "server", "app.ts"), "utf8");
    const developmentEntry = fs.readFileSync(path.join(root, "server", "_core", "index.ts"), "utf8");

    expect(appSource).not.toContain('"./_core/vite"');
    expect(appSource).not.toContain("setupVite");
    expect(developmentEntry).toContain('import { serveStatic, setupVite } from "./vite";');
  });
});
