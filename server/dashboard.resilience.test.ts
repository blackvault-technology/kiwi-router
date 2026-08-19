import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(new URL("../client/src/components/KiwiDashboard.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("dashboard resilience and referral UX", () => {
  it("guards public authentication screens from the session query loading state", () => {
    expect(appSource).toContain("enabled: !publicContentRoute");
    expect(appSource).toContain("authEntryRoute");
    expect(dashboardSource).toContain('new URLSearchParams(window.location.search).get("ref")');
    expect(dashboardSource).toContain("referralCode: referralCode.trim() || undefined");
  });

  it("uses error notices and array normalization before rendering query-driven lists", () => {
    expect(dashboardSource).toContain("function QueryNotice");
    expect(dashboardSource).toContain("const asArray");
    expect(dashboardSource).toContain("<ViewBoundary>{view}</ViewBoundary>");
  });

  it("keeps coupon redemption, referral sharing, and founder coupon controls available in the interface", () => {
    expect(dashboardSource).toContain("trpc.coupons.redeem.useMutation");
    expect(dashboardSource).toContain("trpc.referrals.stats.useQuery");
    expect(dashboardSource).toContain("trpc.admin.createCoupon.useMutation");
    expect(dashboardSource).toContain("trpc.admin.deactivateCoupon.useMutation");
  });
});
