import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { encryptSecret } from "./crypto";
import { createApiKey, createModel, createUser, getAnalytics, getOverview, getRateLimitSettings, getUserByEmail, listApiKeys, listModels, listProviders, listUsers, revokeApiKey, saveProvider, saveRateLimits, seedDemoData, setUserDisabled, updateModel } from "./db";
import { endSession, hashPassword, startSession, toPublicUser, verifyPassword } from "./auth";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128);

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema })).mutation(async ({ input, ctx }) => {
      if (await getUserByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      const user = await createUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
      await startSession(ctx.res, user);
      return toPublicUser(user);
    }),
    login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash)) || user.isDisabled) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect" });
      await startSession(ctx.res, user);
      return toPublicUser(user);
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => { await endSession(ctx.req, ctx.res); return { success: true }; }),
  }),
  dashboard: router({ overview: protectedProcedure.query(({ ctx }) => getOverview(ctx.user.id)), analytics: protectedProcedure.query(({ ctx }) => getAnalytics(ctx.user.id)) }),
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(({ ctx, input }) => createApiKey(ctx.user.id, input.name)),
    revoke: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => ({ success: await revokeApiKey(ctx.user.id, input.id) })),
  }),
  models: router({ list: protectedProcedure.query(() => listModels()) }),
  admin: router({
    users: adminProcedure.query(() => listUsers()),
    setUserDisabled: adminProcedure.input(z.object({ id: z.number().int().positive(), isDisabled: z.boolean() })).mutation(({ input }) => setUserDisabled(input.id, input.isDisabled)),
    models: adminProcedure.query(() => listModels(false)),
    createModel: adminProcedure.input(z.object({ slug: z.string().min(3).max(120), displayName: z.string().min(2).max(120), providerId: z.number().int().positive(), upstreamId: z.string().min(1).max(160), contextWindow: z.number().int().min(1).max(2_000_000), inputPrice: z.string(), outputPrice: z.string(), isEnabled: z.boolean() })).mutation(({ input }) => createModel(input)),
    updateModel: adminProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean().optional(), displayName: z.string().min(2).max(120).optional(), upstreamId: z.string().min(1).max(160).optional() })).mutation(({ input }) => { const { id, ...values } = input; return updateModel(id, values); }),
    providers: adminProcedure.query(() => listProviders()),
    saveProvider: adminProcedure.input(z.object({ slug: z.string().trim().min(2).max(50), displayName: z.string().trim().min(2).max(100), baseUrl: z.string().url(), apiKey: z.string().trim().min(1).optional(), isEnabled: z.boolean() })).mutation(({ input }) => saveProvider({ slug: input.slug, displayName: input.displayName, baseUrl: input.baseUrl, isEnabled: input.isEnabled, encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : undefined })),
    rateLimits: adminProcedure.query(() => getRateLimitSettings()),
    saveRateLimits: adminProcedure.input(z.object({ requestsPerMinute: z.number().int().min(1).max(10000), tokensPerMinute: z.number().int().min(100).max(10_000_000) })).mutation(({ input }) => saveRateLimits(input)),
    seedDemo: adminProcedure.mutation(async ({ ctx }) => { await seedDemoData(ctx.user.id); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
