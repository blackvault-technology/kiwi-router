import { beforeEach, describe, expect, it, vi } from "vitest";

const { takeRateLimit, recordSecurityEvent } = vi.hoisted(() => ({ takeRateLimit: vi.fn(), recordSecurityEvent: vi.fn() }));

vi.mock("./db", () => ({ takeRateLimit, recordSecurityEvent }));

import { enforceRateLimit } from "./security";

describe("shared rate-limit guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permits a request within the configured window", async () => {
    takeRateLimit.mockResolvedValue({ allowed: true, remaining: 3, retryAfterSeconds: 10 });
    await expect(enforceRateLimit({ scope: "trpc:account", subject: "1", maxHits: 5, windowMs: 60_000 })).resolves.toMatchObject({ allowed: true });
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("records and rejects an over-limit request", async () => {
    takeRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 24 });
    await expect(enforceRateLimit({ scope: "trpc:account", subject: "1", maxHits: 5, windowMs: 60_000, ipAddress: "203.0.113.1", userId: 1 })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "rate_limit_blocked", userId: 1 }));
  });
});
