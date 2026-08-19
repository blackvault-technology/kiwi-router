import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }));
vi.mock("./security", () => ({ enforceRateLimit }));

import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const testRouter = router({ protectedPing: protectedProcedure.query(() => ({ ok: true })), founderPing: adminProcedure.query(() => ({ founder: true })) });

function context(): TrpcContext {
  return {
    user: { id: 77, name: "Test User", email: "test@example.com", passwordHash: "hash", role: "user", isDisabled: false, emailVerifiedAt: new Date(), emailVerificationSentAt: null, failedLoginCount: 0, lockedUntil: null, stipendCredits: "0", purchasedCredits: "0", stripeCustomerId: null, createdAt: new Date(), updatedAt: new Date(), sessionId: "session", expiresAt: new Date(Date.now() + 60_000) },
    req: { headers: { "x-forwarded-for": "203.0.113.55" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function founderContext(): TrpcContext {
  const ctx = context();
  ctx.user = { ...ctx.user!, id: 1, email: "indiasikhotechno@gmail.com", role: "founder" };
  return ctx;
}

describe("protected tRPC rate limits", () => {
  it("applies account and account/IP limit checks before protected execution", async () => {
    enforceRateLimit.mockResolvedValue({ allowed: true });
    const result = await testRouter.createCaller(context()).protectedPing();
    expect(result).toEqual({ ok: true });
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "trpc:account", subject: "77" }));
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "trpc:account-ip", subject: "77:203.0.113.55" }));
  });

  it("returns a 429-class error when the account limit is exceeded", async () => {
    enforceRateLimit.mockRejectedValue(new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" }));
    await expect(testRouter.createCaller(context()).protectedPing()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("applies the same layered protections to founder-only procedures", async () => {
    enforceRateLimit.mockResolvedValue({ allowed: true });
    await expect(testRouter.createCaller(founderContext()).founderPing()).resolves.toEqual({ founder: true });
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "trpc:account", subject: "1" }));
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: "trpc:account-ip", subject: "1:203.0.113.55" }));
  });

  it("surfaces a 429-class result on a repeated protected caller flow", async () => {
    enforceRateLimit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: true }).mockRejectedValueOnce(new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" }));
    const caller = testRouter.createCaller(context());
    await expect(caller.protectedPing()).resolves.toEqual({ ok: true });
    await expect(caller.protectedPing()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
