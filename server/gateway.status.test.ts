import { describe, expect, it } from "vitest";
import { overallStatus, type StatusComponent } from "./gateway";

describe("public API status semantics", () => {
  const component = (status: "operational" | "degraded"): StatusComponent => ({ id: "database", name: "Neon database", status, latencyMs: 12, detail: "test" });

  it("reports operational only when every monitored component is operational", () => {
    expect(overallStatus([component("operational"), component("operational")])).toBe("operational");
  });

  it("reports degraded when any monitored component needs attention", () => {
    expect(overallStatus([component("operational"), component("degraded")])).toBe("degraded");
  });
});
