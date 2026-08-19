import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeStatus } from "../client/src/pages/StatusPage";

const source = readFileSync(new URL("../client/src/pages/StatusPage.tsx", import.meta.url), "utf8");

describe("public status page contract", () => {
  it("accepts only complete safe component snapshots", () => {
    expect(normalizeStatus({ status: "operational", service: "cloudhug-kiwi-router", checkedAt: "2026-08-19T00:00:00.000Z", components: [{ id: "database", name: "Neon database", status: "operational", latencyMs: 14, detail: "Connectivity check succeeded" }] })).toMatchObject({ status: "operational", components: [{ id: "database", latencyMs: 14 }] });
    expect(normalizeStatus({ status: "unknown", checkedAt: "now", components: [] })).toBeNull();
    expect(normalizeStatus({ status: "operational", checkedAt: "now", components: [{}] })).toMatchObject({ components: [] });
  });

  it("keeps live component, latency, timestamp, API-link, and degraded fallback rendering in the route", () => {
    expect(source).toContain('fetch("/api/status"');
    expect(source).toContain("Checked in");
    expect(source).toContain("Last checked");
    expect(source).toContain("Status data is temporarily unavailable");
    expect(source).toContain('const apiOrigin = "https://kiwi-router.vercel.app"');
    expect(source).toContain("${apiOrigin}/api/status");
  });
});
