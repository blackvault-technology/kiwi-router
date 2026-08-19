import { describe, expect, it } from "vitest";
import { emailDeliveryConfigured } from "./email";

describe("transactional email configuration", () => {
  it("reports whether both server-only delivery settings are present", () => {
    expect(emailDeliveryConfigured()).toBe(Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL));
  });
});
