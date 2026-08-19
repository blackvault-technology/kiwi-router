import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { encryptSecret } from "./crypto";
import { banUserAccess, createAnnouncement, createApiKey, createModel, createUser, getAnalytics, getCreditEconomy, getOverview, getRateLimitSettings, getUserByEmail, getUserForensics, listAnnouncements, listApiKeys, listModels, listProviders, listUsers, recordLogin, revokeApiKey, saveProvider, saveRateLimits, seedDemoData, setAnnouncementActive, setGlobalApiEnabled, setUserDisabled, syncProviderModels, updateModel } from "./db";
import { endSession, hashApiKey, hashPassword, startSession, toPublicUser, verifyPassword } from "./auth";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addCredits, creditSummary } from "./credits";
import { getRequestIp } from "./founder";
import { CREDIT_PACKS } from "./creditPacks";
import { createCreditCheckout } from "./stripeCredits";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128);

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema })).mutation(async ({ input, ctx }) => {
      if (await getUserByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      const user = await createUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
      await startSession(ctx.res, user);
      await recordLogin(user.id, getRequestIp(ctx.req.headers), ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")!) : undefined);
      return toPublicUser(user);
    }),
    login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash)) || user.isDisabled) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect" });
      await startSession(ctx.res, user);
      await recordLogin(user.id, getRequestIp(ctx.req.headers), ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")!) : undefined);
      return toPublicUser(user);
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => { await endSession(ctx.req, ctx.res); return { success: true }; }),
  }),
  dashboard: router({ overview: protectedProcedure.query(({ ctx }) => getOverview(ctx.user.id)), analytics: protectedProcedure.query(({ ctx }) => getAnalytics(ctx.user.id)), credits: protectedProcedure.query(({ ctx }) => creditSummary(ctx.user.id)), announcements: protectedProcedure.query(() => listAnnouncements()), creditPacks: protectedProcedure.query(() => CREDIT_PACKS), checkoutCredits: protectedProcedure.input(z.object({ packId: z.enum(["sprout", "grove", "orchard"]) })).mutation(({ ctx, input }) => createCreditCheckout({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, packId: input.packId, origin: ctx.req.header("origin") ?? "http://localhost:3000" })) }),
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(({ ctx, input }) => createApiKey(ctx.user.id, input.name)),
    revoke: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => ({ success: await revokeApiKey(ctx.user.id, input.id) })),
  }),
  models: router({ list: protectedProcedure.query(() => listModels()) }),
  admin: router({
    economy: adminProcedure.query(() => getCreditEconomy()),
    users: adminProcedure.query(() => listUsers()),
    forensics: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getUserForensics(input.userId)),
    setUserDisabled: adminProcedure.input(z.object({ id: z.number().int().positive(), isDisabled: z.boolean() })).mutation(({ input, ctx }) => { if (input.id === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "The founder account is immutable" }); return setUserDisabled(input.id, input.isDisabled); }),
    banUser: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(300).default("Founder security action") })).mutation(({ input, ctx }) => banUserAccess(input.id, ctx.user.id, input.reason)),
    mintCredits: adminProcedure.input(z.object({ email: emailSchema, amount: z.number().positive().max(1_000_000), description: z.string().trim().min(3).max(250) })).mutation(async ({ input }) => { const user = await getUserByEmail(input.email); if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" }); return addCredits({ userId: user.id, amount: input.amount, bucket: "purchased", entryType: "grant", description: input.description }); }),
    announcements: adminProcedure.query(() => listAnnouncements(false)),
    createAnnouncement: adminProcedure.input(z.object({ message: z.string().trim().min(3).max(1000), kind: z.string().trim().min(2).max(24).default("notice"), creditsPerUser: z.number().min(0).max(100000).default(0) })).mutation(({ input, ctx }) => createAnnouncement({ ...input, createdBy: ctx.user.id })),
    setAnnouncementActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ input }) => setAnnouncementActive(input.id, input.isActive)),
    models: adminProcedure.query(() => listModels(false)),
    createModel: adminProcedure.input(z.object({ slug: z.string().min(3).max(120), displayName: z.string().min(2).max(120), providerId: z.number().int().positive(), upstreamId: z.string().min(1).max(160), contextWindow: z.number().int().min(1).max(2_000_000), inputPrice: z.string(), outputPrice: z.string(), isEnabled: z.boolean() })).mutation(({ input }) => createModel(input)),
    updateModel: adminProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean().optional(), displayName: z.string().min(2).max(120).optional(), upstreamId: z.string().min(1).max(160).optional(), creditCostPer1kTokens: z.string().regex(/^\d+(\.\d{1,3})?$/).optional() })).mutation(({ input }) => { const { id, ...values } = input; return updateModel(id, values); }),
    providers: adminProcedure.query(() => listProviders()),
    syncProviderModels: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).mutation(({ input }) => syncProviderModels(input.providerId)),
    saveProvider: adminProcedure.input(z.object({ slug: z.string().trim().min(2).max(50), displayName: z.string().trim().min(2).max(100), baseUrl: z.string().url(), apiKey: z.string().trim().min(1).optional(), isEnabled: z.boolean() })).mutation(({ input }) => saveProvider({ slug: input.slug, displayName: input.displayName, baseUrl: input.baseUrl, isEnabled: input.isEnabled, encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : undefined })),
    rateLimits: adminProcedure.query(() => getRateLimitSettings()),
    saveRateLimits: adminProcedure.input(z.object({ requestsPerMinute: z.number().int().min(1).max(10000), tokensPerMinute: z.number().int().min(100).max(10_000_000) })).mutation(({ input }) => saveRateLimits(input)),
    setGlobalApiEnabled: adminProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ input }) => setGlobalApiEnabled(input.enabled)),
    seedDemo: adminProcedure.mutation(async ({ ctx }) => { await seedDemoData(ctx.user.id); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
