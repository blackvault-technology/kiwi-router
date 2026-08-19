import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { encryptSecret } from "./crypto";
import { activateReferralForVerifiedUser, archiveModel, archiveProvider, banUserAccess, claimReferralRewards, clearLoginFailures, consumeAuthToken, createAnnouncement, createApiKey, createAuthToken, createCouponCode, createModel, createPendingReferral, createUser, deactivateCouponCode, deleteAllUserSessions, getAnalytics, getCreditEconomy, getOverview, getRateLimitSettings, getReferralProgramMetrics, getReferralStats, getUserByEmail, getUserById, getUserForensics, listAdminApiKeys, listAdminRequestLogs, listAdminSecurityEvents, listAdminUserLedger, listAdminUserSessions, listAdminUserUsage, listAnnouncements, listApiKeys, listCouponCodes, listModels, listProviderCredentials, listProviderHealth, listProviders, listRateLimitPolicies, listUsers, markEmailVerified, revokeAllUserApiKeys, recordFailedLogin, recordLogin, recordSecurityEvent, redeemCouponCode, revokeApiKey, saveProvider, saveProviderCredential, saveRateLimitPolicy, saveRateLimits, seedDemoData, setAnnouncementActive, setApiKeyProviderAccess, setGlobalApiEnabled, setProviderCredentialActive, setRateLimitPolicyEnabled, setUserDisabled, syncProviderModels, takeRateLimit, testProviderConnection, testProviderCredential, updateModel, updatePasswordAndRevokeSessions } from "./db";
import { endSession, hashApiKey, hashPassword, startSession, toPublicUser, verifyPassword } from "./auth";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addCredits, adjustCredits, creditSummary } from "./credits";
import { getRequestIp } from "./founder";
import { CREDIT_PACKS } from "./creditPacks";
import { createCreditCheckout } from "./stripeCredits";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { enforceAuthRateLimits } from "./security";
import { assertSafeUpstreamUrl } from "./security";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128);

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema, referralCode: z.string().trim().min(4).max(32).optional() })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "register", email: input.email, ipAddress });
      if (await getUserByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      const user = await createUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
      if (input.referralCode && ipAddress) {
        const referral = await createPendingReferral({
          referrerCode: input.referralCode,
          referredUserId: user.id,
          signupIpHash: hashApiKey(ipAddress),
          deviceHash: ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")!) : undefined,
        });
        await recordSecurityEvent({ eventType: referral.created ? "referral_pending_created" : "referral_rejected_at_signup", userId: user.id, ipAddress, metadata: { reason: referral.reason ?? "created" } });
      }
      const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "email_verify", requestIp: ipAddress, expiresInMs: 30 * 60_000 });
      await sendVerificationEmail(ctx.req, user.email, token);
      await recordSecurityEvent({ eventType: "registration_created", userId: user.id, ipAddress });
      return { email: user.email, requiresEmailVerification: true };
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(32).max(256) })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "verify", email: hashApiKey(input.token), ipAddress });
      const token = await consumeAuthToken({ rawToken: input.token, purpose: "email_verify" });
      if (!token?.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid or expired" });
      const user = await markEmailVerified(token.userId);
      if (!user || user.isDisabled) throw new TRPCError({ code: "FORBIDDEN", message: "Account access is unavailable" });
      await startSession(ctx.res, user);
      await recordLogin(user.id, ipAddress, ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")!) : undefined);
      const referral = await activateReferralForVerifiedUser(user.id);
      await recordSecurityEvent({ eventType: "email_verified", userId: user.id, ipAddress, metadata: { referralActivated: referral.activated } });
      return toPublicUser(user);
    }),
    resendVerification: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "verify", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      if (user && !user.emailVerifiedAt && !user.isDisabled) {
        const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "email_verify", requestIp: ipAddress, expiresInMs: 30 * 60_000 });
        await sendVerificationEmail(ctx.req, user.email, token);
        await recordSecurityEvent({ eventType: "verification_resent", userId: user.id, ipAddress });
      }
      return { success: true };
    }),
    login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "login", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      const locked = user?.lockedUntil && user.lockedUntil > new Date();
      if (!user || locked || !(await verifyPassword(input.password, user.passwordHash)) || user.isDisabled) {
        if (user) await recordFailedLogin(user.id);
        await recordSecurityEvent({ eventType: "login_failed", userId: user?.id, ipAddress });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect" });
      }
      if (!user.emailVerifiedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Verify your email address before signing in" });
      await clearLoginFailures(user.id);
      await startSession(ctx.res, user);
      await recordLogin(user.id, ipAddress, ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")!) : undefined);
      await recordSecurityEvent({ eventType: "login_success", userId: user.id, ipAddress });
      return toPublicUser(user);
    }),
    requestPasswordReset: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "password_reset", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      if (user && user.emailVerifiedAt && !user.isDisabled) {
        const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "password_reset", requestIp: ipAddress, expiresInMs: 20 * 60_000 });
        await sendPasswordResetEmail(ctx.req, user.email, token);
        await recordSecurityEvent({ eventType: "password_reset_requested", userId: user.id, ipAddress });
      }
      return { success: true };
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(256), password: passwordSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "password_reset", email: hashApiKey(input.token), ipAddress });
      const token = await consumeAuthToken({ rawToken: input.token, purpose: "password_reset" });
      if (!token?.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link is invalid or expired" });
      const user = await updatePasswordAndRevokeSessions(token.userId, await hashPassword(input.password));
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Account access is unavailable" });
      await recordSecurityEvent({ eventType: "password_reset_completed", userId: user.id, ipAddress });
      return { success: true };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => { await endSession(ctx.req, ctx.res); return { success: true }; }),
  }),
  dashboard: router({ overview: protectedProcedure.query(({ ctx }) => getOverview(ctx.user.id)), analytics: protectedProcedure.query(({ ctx }) => getAnalytics(ctx.user.id)), credits: protectedProcedure.query(({ ctx }) => creditSummary(ctx.user.id)), announcements: protectedProcedure.query(() => listAnnouncements()), creditPacks: protectedProcedure.query(() => CREDIT_PACKS), checkoutCredits: protectedProcedure.input(z.object({ packId: z.enum(["sprout", "grove", "orchard"]) })).mutation(({ ctx, input }) => createCreditCheckout({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, packId: input.packId, origin: ctx.req.header("origin") ?? "http://localhost:3000" })) }),
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(({ ctx, input }) => createApiKey(ctx.user.id, input.name)),
    revoke: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => ({ success: await revokeApiKey(ctx.user.id, input.id) })),
  }),
  coupons: router({
    redeem: protectedProcedure.input(z.object({ code: z.string().trim().min(4).max(64) })).mutation(async ({ ctx, input }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      if (!ipAddress) throw new TRPCError({ code: "BAD_REQUEST", message: "A request IP address is required for coupon redemption" });
      const ipHash = hashApiKey(ipAddress);
      const [userLimit, ipLimit] = await Promise.all([
        takeRateLimit({ scope: "coupon_user", subject: String(ctx.user.id), maxHits: 5, windowMs: 60 * 60_000 }),
        takeRateLimit({ scope: "coupon_ip", subject: ipHash, maxHits: 8, windowMs: 60 * 60_000 }),
      ]);
      if (!userLimit.allowed || !ipLimit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many coupon attempts. Please try again later." });
      const result = await redeemCouponCode({ userId: ctx.user.id, code: input.code, ipHash });
      await recordSecurityEvent({ eventType: result.redeemed ? "coupon_redeemed" : "coupon_redemption_rejected", userId: ctx.user.id, ipAddress, metadata: { reason: result.redeemed ? "success" : result.reason } });
      if (!result.redeemed) throw new TRPCError({ code: "BAD_REQUEST", message: "This coupon is unavailable or has already been used from this account or network." });
      return result;
    }),
  }),
  referrals: router({
    stats: protectedProcedure.query(({ ctx }) => getReferralStats(ctx.user.id)),
    claim: protectedProcedure.mutation(async ({ ctx }) => {
      const rate = await takeRateLimit({ scope: "referral_claim", subject: String(ctx.user.id), maxHits: 5, windowMs: 60 * 60_000 });
      if (!rate.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many referral reward claims. Please try again later." });
      const result = await claimReferralRewards(ctx.user.id);
      await recordSecurityEvent({ eventType: result.claimed ? "referral_rewards_claimed" : "referral_rewards_empty", userId: ctx.user.id, ipAddress: getRequestIp(ctx.req.headers), metadata: { referrals: result.referrals, amount: result.amount } });
      return result;
    }),
  }),
  models: router({ list: protectedProcedure.query(() => listModels()) }),
  admin: router({
    economy: adminProcedure.query(() => getCreditEconomy()),
    users: adminProcedure.input(z.object({ search: z.string().trim().max(160).optional(), status: z.enum(["all", "active", "disabled"]).default("all"), limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0) }).default({ status: "all", limit: 100, offset: 0 })).query(({ input }) => listUsers(input)),
    userSessions: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => listAdminUserSessions(input.userId)),
    revokeUserSessions: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "The founder session cannot be revoked from this panel" }); await deleteAllUserSessions(input.userId); await recordSecurityEvent({ eventType: "founder_user_sessions_revoked", userId: ctx.user.id, metadata: { targetUserId: input.userId } }); return { success: true }; }),
    revokeUserApiKeys: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const revoked = await revokeAllUserApiKeys(input.userId); await recordSecurityEvent({ eventType: "founder_user_api_keys_revoked", userId: ctx.user.id, metadata: { targetUserId: input.userId, count: revoked.length } }); return { count: revoked.length }; }),
    userUsage: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => listAdminUserUsage(input.userId)),
    userLedger: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => listAdminUserLedger(input.userId)),
    requestLogs: adminProcedure.input(z.object({ userId: z.number().int().positive().optional(), modelSlug: z.string().trim().max(120).optional(), status: z.enum(["success", "error"]).optional(), from: z.string().date().optional(), to: z.string().date().optional(), limit: z.number().int().min(1).max(500).default(200) }).default({ limit: 200 })).query(({ input }) => listAdminRequestLogs(input)),
    auditEvents: adminProcedure.input(z.object({ userId: z.number().int().positive().optional(), targetUserId: z.number().int().positive().optional(), eventType: z.string().trim().max(120).optional(), from: z.string().date().optional(), to: z.string().date().optional(), limit: z.number().int().min(1).max(500).default(200) }).default({ limit: 200 })).query(({ input }) => listAdminSecurityEvents(input)),
    forensics: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getUserForensics(input.userId)),
    setUserDisabled: adminProcedure.input(z.object({ id: z.number().int().positive(), isDisabled: z.boolean() })).mutation(async ({ input, ctx }) => { if (input.id === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "The founder account is immutable" }); const user = await setUserDisabled(input.id, input.isDisabled); await recordSecurityEvent({ eventType: "founder_user_access_changed", userId: ctx.user.id, metadata: { targetUserId: input.id, isDisabled: input.isDisabled } }); return user; }),
    banUser: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(300).default("Founder security action") })).mutation(async ({ input, ctx }) => { const user = await banUserAccess(input.id, ctx.user.id, input.reason); await recordSecurityEvent({ eventType: "founder_user_banned", userId: ctx.user.id, metadata: { targetUserId: input.id } }); return user; }),
    mintCredits: adminProcedure.input(z.object({ email: emailSchema, amount: z.number().positive().max(1_000_000), description: z.string().trim().min(3).max(250) })).mutation(async ({ input }) => { const user = await getUserByEmail(input.email); if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" }); return addCredits({ userId: user.id, amount: input.amount, bucket: "purchased", entryType: "grant", description: input.description }); }),
    adjustUserCredits: adminProcedure.input(z.object({ userId: z.number().int().positive(), amount: z.number().finite().refine(value => value !== 0).refine(value => Math.abs(value) <= 1_000_000), bucket: z.enum(["stipend", "purchased"]), description: z.string().trim().min(3).max(250) })).mutation(async ({ input, ctx }) => { const result = await adjustCredits(input); await recordSecurityEvent({ eventType: "founder_user_credit_adjusted", userId: ctx.user.id, metadata: { targetUserId: input.userId, amount: input.amount, bucket: input.bucket } }); return result; }),
    coupons: adminProcedure.query(() => listCouponCodes()),
    createCoupon: adminProcedure.input(z.object({ code: z.string().trim().min(4).max(64), creditsAmount: z.number().positive().max(100_000), maxUses: z.number().int().positive().max(1_000_000).optional(), expiresAt: z.string().datetime().optional() })).mutation(async ({ input, ctx }) => {
      try {
        return await createCouponCode({ ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined, createdBy: ctx.user.id });
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unable to create this coupon. Use a unique, uppercase-friendly code." });
      }
    }),
    deactivateCoupon: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await deactivateCouponCode(input.id) })),
    referralMetrics: adminProcedure.query(() => getReferralProgramMetrics()),
    announcements: adminProcedure.query(() => listAnnouncements(false)),
    createAnnouncement: adminProcedure.input(z.object({ message: z.string().trim().min(3).max(1000), kind: z.string().trim().min(2).max(24).default("notice"), creditsPerUser: z.number().min(0).max(100000).default(0) })).mutation(({ input, ctx }) => createAnnouncement({ ...input, createdBy: ctx.user.id })),
    setAnnouncementActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ input }) => setAnnouncementActive(input.id, input.isActive)),
    models: adminProcedure.query(() => listModels(false)),
    createModel: adminProcedure.input(z.object({ slug: z.string().min(3).max(120), displayName: z.string().min(2).max(120), providerId: z.number().int().positive(), upstreamId: z.string().min(1).max(160), contextWindow: z.number().int().min(1).max(2_000_000), inputPrice: z.string().regex(/^\d+(\.\d{1,6})?$/), outputPrice: z.string().regex(/^\d+(\.\d{1,6})?$/), creditCostPer1kTokens: z.string().regex(/^\d+(\.\d{1,3})?$/).default("1"), isEnabled: z.boolean() })).mutation(async ({ input, ctx }) => { const model = await createModel(input); await recordSecurityEvent({ eventType: "founder_model_created", userId: ctx.user.id, metadata: { modelId: model.id, providerId: input.providerId, isEnabled: input.isEnabled } }); return model; }),
    updateModel: adminProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean().optional(), displayName: z.string().min(2).max(120).optional(), upstreamId: z.string().min(1).max(160).optional(), creditCostPer1kTokens: z.string().regex(/^\d+(\.\d{1,3})?$/).optional() })).mutation(async ({ input, ctx }) => { const { id, ...values } = input; const model = await updateModel(id, values); await recordSecurityEvent({ eventType: "founder_model_updated", userId: ctx.user.id, metadata: { modelId: id, changed: Object.keys(values), isEnabled: values.isEnabled } }); return model; }),
    archiveModel: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const model = await archiveModel(input.id); await recordSecurityEvent({ eventType: "founder_model_archived", userId: ctx.user.id, metadata: { modelId: input.id, slug: model.slug } }); return model; }),
    providers: adminProcedure.query(() => listProviders()),
    providerCredentials: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).query(({ input }) => listProviderCredentials(input.providerId)),
    providerHealth: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).query(({ input }) => listProviderHealth(input.providerId)),
    saveProviderCredential: adminProcedure.input(z.object({ providerId: z.number().int().positive(), name: z.string().trim().min(2).max(80), apiKey: z.string().trim().min(8).max(500) })).mutation(async ({ input, ctx }) => { const saved = await saveProviderCredential({ providerId: input.providerId, name: input.name, encryptedApiKey: encryptSecret(input.apiKey), keyHint: `••••${input.apiKey.slice(-4)}` }); await recordSecurityEvent({ eventType: "founder_provider_credential_created", userId: ctx.user.id, metadata: { providerId: input.providerId, credentialId: saved.id, name: input.name } }); return saved; }),
    setProviderCredentialActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input, ctx }) => { const result = await setProviderCredentialActive(input.id, input.isActive); await recordSecurityEvent({ eventType: "founder_provider_credential_state_changed", userId: ctx.user.id, metadata: { credentialId: input.id, isActive: input.isActive } }); return result; }),
    testProviderCredential: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const result = await testProviderCredential(input.id); await recordSecurityEvent({ eventType: "founder_provider_credential_tested", userId: ctx.user.id, metadata: { credentialId: input.id, ok: result.ok, statusCode: result.statusCode, latencyMs: result.latencyMs } }); return result; }),
    apiKeys: adminProcedure.input(z.object({ providerId: z.number().int().positive().optional() })).query(({ input }) => listAdminApiKeys(input.providerId)),
    setApiKeyProviderAccess: adminProcedure.input(z.object({ apiKeyId: z.string().uuid(), providerId: z.number().int().positive(), isEnabled: z.boolean() })).mutation(async ({ input, ctx }) => { const result = await setApiKeyProviderAccess(input); await recordSecurityEvent({ eventType: "founder_api_key_provider_access_changed", userId: ctx.user.id, metadata: { apiKeyId: input.apiKeyId, providerId: input.providerId, isEnabled: input.isEnabled } }); return result; }),
    syncProviderModels: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const result = await syncProviderModels(input.providerId); await recordSecurityEvent({ eventType: "founder_provider_sync", userId: ctx.user.id, metadata: { providerId: input.providerId, discovered: result.discovered, mode: result.mode, ok: result.ok, statusCode: result.statusCode, latencyMs: "latencyMs" in result ? result.latencyMs : undefined } }); return result; }),
    testProviderConnection: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const result = await testProviderConnection(input.providerId); await recordSecurityEvent({ eventType: "founder_provider_test", userId: ctx.user.id, metadata: { providerId: input.providerId, ok: result.ok, statusCode: result.statusCode, latencyMs: result.latencyMs } }); return result; }),
    archiveProvider: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const provider = await archiveProvider(input.providerId); await recordSecurityEvent({ eventType: "founder_provider_archived", userId: ctx.user.id, metadata: { providerId: input.providerId, slug: provider.slug } }); return provider; }),
    saveProvider: adminProcedure.input(z.object({ slug: z.string().trim().min(2).max(50), displayName: z.string().trim().min(2).max(100), baseUrl: z.string().url(), apiKey: z.string().trim().min(1).optional(), isEnabled: z.boolean() })).mutation(async ({ input, ctx }) => { assertSafeUpstreamUrl(input.baseUrl); const provider = await saveProvider({ slug: input.slug, displayName: input.displayName, baseUrl: input.baseUrl, isEnabled: input.isEnabled, encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : undefined }); await recordSecurityEvent({ eventType: "founder_provider_saved", userId: ctx.user.id, metadata: { providerId: provider.id, isEnabled: input.isEnabled, credentialChanged: Boolean(input.apiKey) } }); return provider; }),
    rateLimits: adminProcedure.query(() => getRateLimitSettings()),
    rateLimitPolicies: adminProcedure.query(() => listRateLimitPolicies()),
    saveRateLimitPolicy: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), scope: z.enum(["user", "ip", "api_key", "provider", "model"]), subject: z.string().trim().min(1).max(160), requestsPerMinute: z.number().int().min(1).max(100000), tokensPerMinute: z.number().int().min(100).max(100000000), isEnabled: z.boolean().default(true) })).mutation(async ({ input, ctx }) => { const result = await saveRateLimitPolicy(input); await recordSecurityEvent({ eventType: "founder_rate_limit_policy_saved", userId: ctx.user.id, metadata: { scope: input.scope, subject: input.subject, requestsPerMinute: input.requestsPerMinute, tokensPerMinute: input.tokensPerMinute } }); return result; }),
    setRateLimitPolicyEnabled: adminProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean() })).mutation(async ({ input, ctx }) => { const result = await setRateLimitPolicyEnabled(input.id, input.isEnabled); await recordSecurityEvent({ eventType: "founder_rate_limit_policy_state_changed", userId: ctx.user.id, metadata: input }); return result; }),
    saveRateLimits: adminProcedure.input(z.object({ requestsPerMinute: z.number().int().min(1).max(10000), tokensPerMinute: z.number().int().min(100).max(10_000_000) })).mutation(async ({ input, ctx }) => { const settings = await saveRateLimits(input); await recordSecurityEvent({ eventType: "founder_rate_limits_saved", userId: ctx.user.id, metadata: input }); return settings; }),
    setGlobalApiEnabled: adminProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ input, ctx }) => { const settings = await setGlobalApiEnabled(input.enabled); await recordSecurityEvent({ eventType: "founder_gateway_switch", userId: ctx.user.id, metadata: { enabled: input.enabled } }); return settings; }),
    seedDemo: adminProcedure.mutation(async ({ ctx }) => { await seedDemoData(ctx.user.id); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
