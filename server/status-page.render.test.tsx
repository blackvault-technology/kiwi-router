import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { StatusPage } from "../client/src/pages/StatusPage";

function renderStatus(element: React.ReactElement) {
  return renderToStaticMarkup(<Router hook={() => ["/status", () => {}]}>{element}</Router>);
}

describe("StatusPage rendered states", () => {
  it("renders live component cards, latency, checked timestamp, and API link from a successful status snapshot", () => {
    const html = renderStatus(<StatusPage initialSnapshot={{ status: "degraded", service: "cloudhug-kiwi-router", checkedAt: "2026-08-19T10:40:39.067Z", components: [
      { id: "database", name: "Neon database", status: "operational", latencyMs: 16, detail: "Connectivity check succeeded" },
      { id: "providers", name: "Provider configuration", status: "degraded", latencyMs: 19, detail: "0 configured providers" },
    ] }} />);
    expect(html).toContain("Neon database");
    expect(html).toContain("Provider configuration");
    expect(html).toContain("Checked in 16 ms");
    expect(html).toContain("Last checked");
    expect(html).toContain("https://kiwi-router.vercel.app/api/status");
    expect(html).toContain("One or more monitored systems need attention");
  });

  it("renders the safe unavailable fallback when a status request fails", () => {
    const html = renderStatus(<StatusPage initialError />);
    expect(html).toContain("Status data is temporarily unavailable");
    expect(html).toContain("The status endpoint could not be reached");
    expect(html).toContain("This page does not guess component health");
  });
});
