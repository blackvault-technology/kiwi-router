import { describe, expect, it } from "vitest";
import { describeEmailDelivery, emailDeliveryConfigured } from "./email";

describe("Neon transactional email outbox configuration", () => {
  it("uses Neon database configuration as the only delivery prerequisite", () => {
    expect(emailDeliveryConfigured()).toBe(Boolean(process.env.NEON_DATABASE_URL));
  });

  it("describes the delivery model without claiming inbox delivery", () => {
    expect(describeEmailDelivery()).toContain("Neon email_outbox");
    expect(describeEmailDelivery()).not.toContain("Resend");
  });

  it("does not depend on external sender or domain configuration", () => {
    expect(describeEmailDelivery()).toContain("no external email provider");
    expect(emailDeliveryConfigured()).toBe(Boolean(process.env.NEON_DATABASE_URL));
  });
});
