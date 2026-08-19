import { TRPCError } from "@trpc/server";
import { recordSecurityEvent, takeRateLimit } from "./db";

export async function enforceRateLimit(input: { scope: string; subject: string; maxHits: number; windowMs: number; ipAddress?: string; userId?: number }) {
  const result = await takeRateLimit(input);
  if (result.allowed) return result;
  await recordSecurityEvent({ eventType: "rate_limit_blocked", userId: input.userId, ipAddress: input.ipAddress, metadata: { scope: input.scope } });
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please wait and try again.", cause: { retryAfterSeconds: result.retryAfterSeconds } });
}

export async function enforceAuthRateLimits(input: { action: "register" | "login" | "verify" | "password_reset"; email: string; ipAddress?: string }) {
  const windowMs = 15 * 60_000;
  await enforceRateLimit({ scope: `auth:${input.action}:ip`, subject: input.ipAddress || "unknown", maxHits: input.action === "login" ? 12 : 8, windowMs, ipAddress: input.ipAddress });
  await enforceRateLimit({ scope: `auth:${input.action}:email`, subject: input.email.toLowerCase(), maxHits: input.action === "login" ? 8 : 5, windowMs, ipAddress: input.ipAddress });
}

export function assertSafeUpstreamUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const privateIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  if (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local") || privateIpv4.test(hostname) || hostname === "::1") throw new Error("Provider URLs must use public HTTPS endpoints");
  return url;
}
