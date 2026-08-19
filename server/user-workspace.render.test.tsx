import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserWorkspaceStarter } from "../client/src/components/KiwiDashboard";

const baseUser = {
  id: 4,
  name: "Developer User",
  email: "developer@example.com",
  isDisabled: false,
  emailVerified: true,
  stipendCredits: 10,
  purchasedCredits: 15,
  kiwiCredits: 25,
  createdAt: new Date(),
} as const;

describe("standard user workspace starter", () => {
  it("renders focused API-key and gateway-test actions for a verified standard user", () => {
    const html = renderToStaticMarkup(<UserWorkspaceStarter user={{ ...baseUser, role: "user" }} onNavigate={() => undefined} />);
    expect(html).toContain("Your developer workspace");
    expect(html).toContain("Email verified · gateway access ready");
    expect(html).toContain("Create API key");
    expect(html).toContain("Test gateway");
    for (const label of ["API keys", "Models", "Credits &amp; coupons", "Referrals", "Usage", "Playground"]) expect(html).toContain(label);
    for (const detail of ["Create and revoke access", "Browse enabled routes", "Top up or redeem", "Invite and claim", "Review gateway activity", "Test a completion"]) expect(html).toContain(detail);
    for (const workflow of ["Create API key", "Redeem a coupon or top up credits, then", "Invite and claim", "Review gateway activity", "Test gateway"]) expect(html).toContain(workflow);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("xl:grid-cols-3");
    expect(html).not.toContain("Founder Console");
  });

  it("renders no standard-user starter inside the founder workspace", () => {
    const html = renderToStaticMarkup(<UserWorkspaceStarter user={{ ...baseUser, role: "founder" }} onNavigate={() => undefined} />);
    expect(html).toBe("");
  });

  it("renders contextual model and playground guidance for the active user-workspace view", () => {
    const modelHtml = renderToStaticMarkup(<UserWorkspaceStarter user={{ ...baseUser, role: "user" }} activePath="/app/models" onNavigate={() => undefined} />);
    const playgroundHtml = renderToStaticMarkup(<UserWorkspaceStarter user={{ ...baseUser, role: "user" }} activePath="/app/playground" onNavigate={() => undefined} />);
    expect(modelHtml).toContain("Choose an enabled route here before opening the Playground");
    expect(playgroundHtml).toContain("Choose a model and use a raw Kiwi key");
  });
});
