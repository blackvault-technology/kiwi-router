import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { FOUNDER_EMAIL } from "../founder";
import { getRequestIp } from "../founder";
import { enforceRateLimit } from "../security";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const accountRateLimit = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const ipAddress = getRequestIp(ctx.req.headers);
  await enforceRateLimit({ scope: "trpc:account", subject: String(ctx.user.id), maxHits: 120, windowMs: 60_000, userId: ctx.user.id, ipAddress });
  await enforceRateLimit({ scope: "trpc:account-ip", subject: `${ctx.user.id}:${ipAddress || "unknown"}`, maxHits: 90, windowMs: 60_000, userId: ctx.user.id, ipAddress });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser).use(accountRateLimit);

const requireFounder = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user || ctx.user.email !== FOUNDER_EMAIL || ctx.user.role !== "founder") throw new TRPCError({ code: "FORBIDDEN", message: "Founder access is required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireFounder).use(accountRateLimit);
