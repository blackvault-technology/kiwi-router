import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { accessBans, announcements, apiKeys, apiKeyProviderAccess, authTokens, emailOutbox, googleIdentities, couponCodes, couponRedemptions, creditLedger, loginRecords, models, providerCredentials, providerHealthChecks, providers, rateLimitBuckets, rateLimitPolicies, rateLimitSettings, referrals, requestLogs, securityEvents, sessions, usageDaily, users, type User } from "../drizzle/schema";
import { hashApiKey } from "./auth";
import { isFounderEmail, normalizeEmail } from "./founder";
import { decryptSecret } from "./crypto";

let database: ReturnType<typeof drizzle> | undefined;

export function queryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export function getDb() {
  if (!database) {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL must be configured");
    database = drizzle(neon(connectionString));
  }
  return database;
}

export async function getUserByEmail(email: string) {
  return (await getDb().select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1))[0];
}

export async function getUserById(id: number) {
  return (await getDb().select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export function generateReferralCode() {
  return `KR${randomBytes(9).toString("hex").toUpperCase()}`;
}

export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  const email = normalizeEmail(input.email);
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const saved = await db.insert(users).values({ ...input, email, role: isFounderEmail(email) ? "founder" : "user", referralCode: generateReferralCode() })
      .onConflictDoNothing({ target: users.referralCode }).returning();
    if (saved[0]) return saved[0];
  }
  throw new Error("Unable to allocate a unique referral code");
}

export async function getOrCreateReferralCode(userId: number) {
  const db = getDb();
  const current = (await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!current) throw new Error("User not found");
  if (current.referralCode) return current.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = generateReferralCode();
    try {
      const saved = await db.update(users).set({ referralCode, updatedAt: new Date() }).where(and(eq(users.id, userId), isNull(users.referralCode))).returning({ referralCode: users.referralCode });
      if (saved[0]?.referralCode) return saved[0].referralCode;
      const existing = (await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1))[0]?.referralCode;
      if (existing) return existing;
    } catch {
      // A statistically unlikely unique-code collision is retried without exposing database details.
    }
  }
  throw new Error("Unable to allocate a unique referral code");
}

export async function promoteFounderRecord() {
  return (await getDb().update(users).set({ role: "founder", isDisabled: false, updatedAt: new Date() }).where(eq(users.email, "indiasikhotechno@gmail.com")).returning())[0];
}

export async function getGoogleIdentity(googleSubject: string) {
  return (await getDb().select().from(googleIdentities).where(eq(googleIdentities.googleSubject, googleSubject)).limit(1))[0];
}

export async function getGoogleIdentityByEmail(email: string) {
  return (await getDb().select().from(googleIdentities).where(eq(googleIdentities.email, normalizeEmail(email))).limit(1))[0];
}

export async function upsertGoogleIdentity(input: { userId: number; googleSubject: string; email: string; displayName: string; avatarUrl?: string }) {
  return (await getDb().insert(googleIdentities).values({ ...input, email: normalizeEmail(input.email) }).onConflictDoUpdate({ target: googleIdentities.googleSubject, set: { userId: input.userId, email: normalizeEmail(input.email), displayName: input.displayName, avatarUrl: input.avatarUrl, updatedAt: new Date() } }).returning())[0]!;
}

export async function createSession(userId: number, expiresAt: Date) {
  return (await getDb().insert(sessions).values({ id: randomUUID(), userId, expiresAt }).returning())[0]!;
}

export async function deleteSession(id: string) {
  await getDb().delete(sessions).where(eq(sessions.id, id));
}

export async function deleteAllUserSessions(userId: number) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function getSessionWithUser(sessionId: string, userId: number) {
  const record = await getDb().select({
    sessionId: sessions.id, expiresAt: sessions.expiresAt, id: users.id, name: users.name, email: users.email,
    passwordHash: users.passwordHash, role: users.role, isDisabled: users.isDisabled, emailVerifiedAt: users.emailVerifiedAt, emailVerificationSentAt: users.emailVerificationSentAt, failedLoginCount: users.failedLoginCount, lockedUntil: users.lockedUntil, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits, stripeCustomerId: users.stripeCustomerId, referralCode: users.referralCode, createdAt: users.createdAt, updatedAt: users.updatedAt,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
  return record[0] as (User & { sessionId: string; expiresAt: Date }) | undefined;
}

export async function markEmailVerified(userId: number) {
  return (await getDb().update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId)).returning())[0];
}

export async function updatePasswordAndRevokeSessions(userId: number, passwordHash: string) {
  const user = (await getDb().update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, userId)).returning())[0];
  await deleteAllUserSessions(userId);
  return user;
}

export async function recordFailedLogin(userId: number) {
  const user = await getUserById(userId);
  if (!user) return;
  const next = user.failedLoginCount + 1;
  await getDb().update(users).set({ failedLoginCount: next, lockedUntil: next >= 5 ? new Date(Date.now() + 15 * 60_000) : user.lockedUntil, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function clearLoginFailures(userId: number) {
  await getDb().update(users).set({ failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function createApiKey(userId: number, name: string) {
  const plainKey = `kiwi_sk_${randomBytes(24).toString("base64url")}`;
  const saved = (await getDb().insert(apiKeys).values({ userId, name, keyPrefix: plainKey.slice(0, 16), keyHash: hashApiKey(plainKey), lastFour: plainKey.slice(-4) }).returning())[0]!;
  return { ...saved, plainKey };
}

export async function listApiKeys(userId: number) {
  return getDb().select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastFour: apiKeys.lastFour, isActive: apiKeys.isActive, lastUsedAt: apiKeys.lastUsedAt, expiresAt: apiKeys.expiresAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(userId: number, id: string) {
  const result = await getDb().update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  return Boolean(result[0]);
}

export async function rotateUserApiKeys(userId: number) {
  const db = getDb();
  const revoked = await db.update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  const replacement = await createApiKey(userId, "Founder rotation");
  return { revokedCount: revoked.length, replacement: { id: replacement.id, keyPrefix: replacement.keyPrefix, lastFour: replacement.lastFour, plainKey: replacement.plainKey } };
}

export async function expireUserApiKeys(userId: number) {
  const expired = await getDb().update(apiKeys).set({ isActive: false, expiresAt: new Date() }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  return { count: expired.length };
}

export async function quarantineUserApiKeys(userId: number) {
  const revoked = await getDb().update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  return { count: revoked.length };
}

export async function getApiKeyOwner(plainKey: string) {
  const result = await getDb().select({ apiKey: apiKeys, user: users }).from(apiKeys).innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, hashApiKey(plainKey)), eq(apiKeys.isActive, true), sql<boolean>`(${apiKeys.expiresAt} IS NULL OR ${apiKeys.expiresAt} > NOW())`, eq(users.isDisabled, false))).limit(1);
  if (!result[0]) return undefined;
  await getDb().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, result[0].apiKey.id));
  return result[0];
}

export async function listModels(enabledOnly = true) {
  const query = getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id));
  const rows = enabledOnly ? await query.where(and(eq(models.isEnabled, true), eq(providers.isEnabled, true))).orderBy(models.slug) : await query.orderBy(models.slug);
  const seen = new Set<string>();
  return rows.filter(row => { if (seen.has(row.model.slug)) return false; seen.add(row.model.slug); return true; });
}

export async function getGatewayRoutes(slug: string) {
  return getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.slug, slug), eq(models.isEnabled, true), eq(providers.isEnabled, true))).orderBy(sql`${providers.isHealthy} DESC`, sql`COALESCE((${models.routingConfig}->>'priority')::int, 100) ASC`, models.id);
}

export async function getGatewayRoute(slug: string) {
  return (await getGatewayRoutes(slug).then(rows => rows.slice(0, 1)))[0];
}

export async function getGatewayFallbackRoute(slug: string, providerId: number) {
  return (await getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.slug, slug), eq(models.providerId, providerId), eq(models.isEnabled, true), eq(providers.isEnabled, true))).limit(1))[0];
}

export type ModelRoutingConfig = { protocol: "openai" | "anthropic" | "gemini"; priority: number; fallbackProviderId?: number; capabilities: { streaming: boolean; vision: boolean; tools: boolean; jsonMode: boolean; reasoning: boolean }; headers?: Record<string, string> };

export async function createModel(input: { slug: string; displayName: string; providerId: number; upstreamId: string; contextWindow: number; inputPrice: string; outputPrice: string; creditCostPer1kTokens: string; isEnabled: boolean; routingConfig?: ModelRoutingConfig }) {
  return (await getDb().insert(models).values({ ...input, routingConfig: input.routingConfig ?? { protocol: "openai", priority: 100, capabilities: { streaming: true, vision: false, tools: false, jsonMode: false, reasoning: false } } }).returning())[0]!;
}

export async function updateModel(id: number, input: { isEnabled?: boolean; displayName?: string; upstreamId?: string; creditCostPer1kTokens?: string; routingConfig?: ModelRoutingConfig }) {
  return (await getDb().update(models).set({ ...input, updatedAt: new Date() }).where(eq(models.id, id)).returning())[0];
}

export async function listProviders() {
  return getDb().select({ id: providers.id, slug: providers.slug, displayName: providers.displayName, baseUrl: providers.baseUrl, protocol: providers.protocol, requestHeaders: providers.requestHeaders, isHealthy: providers.isHealthy, isEnabled: providers.isEnabled, isConfigured: sql<boolean>`(${providers.encryptedApiKey} IS NOT NULL OR EXISTS (SELECT 1 FROM provider_credentials pc WHERE pc.provider_id = ${providers.id} AND pc.is_active = true))` }).from(providers).orderBy(providers.displayName);
}

async function resolveProviderCredential(providerId: number) {
  const profile = (await getDb().select({ encryptedApiKey: providerCredentials.encryptedApiKey, id: providerCredentials.id }).from(providerCredentials).where(and(eq(providerCredentials.providerId, providerId), eq(providerCredentials.isActive, true))).orderBy(desc(providerCredentials.updatedAt)).limit(1))[0];
  if (profile) return profile;
  const legacy = (await getDb().select({ encryptedApiKey: providers.encryptedApiKey }).from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  return legacy?.encryptedApiKey ? { encryptedApiKey: legacy.encryptedApiKey, id: null } : undefined;
}

export async function getProviderRuntimeCredential(providerId: number) {
  const credential = await resolveProviderCredential(providerId);
  return credential ? decryptSecret(credential.encryptedApiKey) : undefined;
}

export async function listProviderCredentials(providerId: number) {
  return getDb().select({ id: providerCredentials.id, providerId: providerCredentials.providerId, name: providerCredentials.name, keyHint: providerCredentials.keyHint, isActive: providerCredentials.isActive, lastTestedAt: providerCredentials.lastTestedAt, lastTestOk: providerCredentials.lastTestOk, lastTestLatencyMs: providerCredentials.lastTestLatencyMs, lastSuccessAt: providerCredentials.lastSuccessAt, createdAt: providerCredentials.createdAt, updatedAt: providerCredentials.updatedAt }).from(providerCredentials).where(eq(providerCredentials.providerId, providerId)).orderBy(desc(providerCredentials.updatedAt));
}

export async function saveProviderCredential(input: { providerId: number; name: string; encryptedApiKey: string; keyHint: string }) {
  return (await getDb().insert(providerCredentials).values(input).returning({ id: providerCredentials.id, providerId: providerCredentials.providerId, name: providerCredentials.name, keyHint: providerCredentials.keyHint, isActive: providerCredentials.isActive, createdAt: providerCredentials.createdAt }))[0]!;
}

export async function setProviderCredentialActive(id: number, isActive: boolean) {
  return (await getDb().update(providerCredentials).set({ isActive, updatedAt: new Date() }).where(eq(providerCredentials.id, id)).returning({ id: providerCredentials.id, providerId: providerCredentials.providerId, isActive: providerCredentials.isActive }))[0];
}

export async function testProviderCredential(credentialId: number) {
  const row = (await getDb().select({ credential: providerCredentials, provider: providers }).from(providerCredentials).innerJoin(providers, eq(providerCredentials.providerId, providers.id)).where(eq(providerCredentials.id, credentialId)).limit(1))[0];
  if (!row) throw new Error("Provider credential not found");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${row.provider.baseUrl.replace(/\/$/, "")}/models`, { headers: row.provider.slug === "anthropic" ? { "x-api-key": decryptSecret(row.credential.encryptedApiKey), "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${decryptSecret(row.credential.encryptedApiKey)}` }, signal: controller.signal });
    const result = { ok: response.ok, statusCode: response.status, latencyMs: Date.now() - startedAt, detail: response.ok ? "Credential handshake succeeded" : "Provider rejected this credential" };
    await getDb().update(providerCredentials).set({ lastTestedAt: new Date(), lastTestOk: result.ok, lastTestLatencyMs: result.latencyMs, lastSuccessAt: result.ok ? new Date() : undefined, updatedAt: new Date() }).where(eq(providerCredentials.id, credentialId));
    await getDb().insert(providerHealthChecks).values({ providerId: row.provider.id, credentialId, ok: result.ok, statusCode: result.statusCode, latencyMs: result.latencyMs, detail: result.detail });
    return result;
  } catch {
    const result = { ok: false, statusCode: null, latencyMs: Date.now() - startedAt, detail: "Credential handshake did not complete" };
    await getDb().update(providerCredentials).set({ lastTestedAt: new Date(), lastTestOk: false, lastTestLatencyMs: result.latencyMs, updatedAt: new Date() }).where(eq(providerCredentials.id, credentialId));
    await getDb().insert(providerHealthChecks).values({ providerId: row.provider.id, credentialId, ok: false, statusCode: null, latencyMs: result.latencyMs, detail: result.detail });
    return result;
  } finally { clearTimeout(timeout); }
}

export async function listProviderHealth(providerId: number) {
  return getDb().select({ id: providerHealthChecks.id, providerId: providerHealthChecks.providerId, credentialId: providerHealthChecks.credentialId, ok: providerHealthChecks.ok, statusCode: providerHealthChecks.statusCode, latencyMs: providerHealthChecks.latencyMs, detail: providerHealthChecks.detail, createdAt: providerHealthChecks.createdAt }).from(providerHealthChecks).where(eq(providerHealthChecks.providerId, providerId)).orderBy(desc(providerHealthChecks.createdAt)).limit(100);
}

export async function listAdminApiKeys(providerId?: number) {
  const rows = await getDb().select({ id: apiKeys.id, userId: apiKeys.userId, userEmail: users.email, userName: users.name, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastFour: apiKeys.lastFour, isActive: apiKeys.isActive, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, accessIsEnabled: apiKeyProviderAccess.isEnabled, createdAt: apiKeys.createdAt }).from(apiKeys).innerJoin(users, eq(apiKeys.userId, users.id)).leftJoin(apiKeyProviderAccess, eq(apiKeys.id, apiKeyProviderAccess.apiKeyId)).where(providerId ? eq(apiKeyProviderAccess.providerId, providerId) : undefined).orderBy(desc(apiKeys.createdAt)).limit(500);
  return rows;
}

export async function setApiKeyProviderAccess(input: { apiKeyId: string; providerId: number; isEnabled: boolean }) {
  const existing = (await getDb().select({ id: apiKeyProviderAccess.id }).from(apiKeyProviderAccess).where(and(eq(apiKeyProviderAccess.apiKeyId, input.apiKeyId), eq(apiKeyProviderAccess.providerId, input.providerId))).limit(1))[0];
  if (existing) return (await getDb().update(apiKeyProviderAccess).set({ isEnabled: input.isEnabled, updatedAt: new Date() }).where(eq(apiKeyProviderAccess.id, existing.id)).returning())[0];
  return (await getDb().insert(apiKeyProviderAccess).values(input).returning())[0];
}

export async function saveProvider(input: { slug: string; displayName: string; baseUrl: string; protocol?: string; requestHeaders?: Record<string, string>; encryptedApiKey?: string; isEnabled: boolean }) {
  const existing = (await getDb().select().from(providers).where(eq(providers.slug, input.slug)).limit(1))[0];
  const values = { ...input, updatedAt: new Date() };
  if (existing) return (await getDb().update(providers).set(values).where(eq(providers.id, existing.id)).returning())[0]!;
  return (await getDb().insert(providers).values({ ...values, isHealthy: Boolean(input.encryptedApiKey) }).returning())[0]!;
}

export async function logRequest(input: { userId: number; apiKeyId: string; modelSlug: string; status: "success" | "error"; inputTokens: number; outputTokens: number; latencyMs: number; errorCode?: string; creditsDeducted?: number; ipAddress?: string; userAgentHash?: string; createdAt?: Date }) {
  const db = getDb();
  const createdAt = input.createdAt ?? new Date();
  const { createdAt: _ignored, creditsDeducted, ...logValues } = input;
  await db.insert(requestLogs).values({ ...logValues, creditsDeducted: creditsDeducted?.toFixed(3), createdAt });
  await db.insert(usageDaily).values({
    userId: input.userId,
    day: createdAt.toISOString().slice(0, 10),
    requests: 1,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    errorCount: input.status === "error" ? 1 : 0,
    totalLatencyMs: input.latencyMs,
    updatedAt: createdAt,
  }).onConflictDoUpdate({
    target: [usageDaily.userId, usageDaily.day],
    set: {
      requests: sql`${usageDaily.requests} + 1`,
      inputTokens: sql`${usageDaily.inputTokens} + ${input.inputTokens}`,
      outputTokens: sql`${usageDaily.outputTokens} + ${input.outputTokens}`,
      errorCount: sql`${usageDaily.errorCount} + ${input.status === "error" ? 1 : 0}`,
      totalLatencyMs: sql`${usageDaily.totalLatencyMs} + ${input.latencyMs}`,
      updatedAt: createdAt,
    },
  });
}

export async function checkRateLimit(userId: number, ipAddress?: string) {
  const db = getDb();
  const setting = (await db.select().from(rateLimitSettings).limit(1))[0] ?? { requestsPerMinute: 30, tokensPerMinute: 10000, ipRequestsPerMinute: 60, globalApiEnabled: true };
  if (!setting.globalApiEnabled) return { allowed: false, limit: setting, reason: "api_disabled" };
  const policyRows = await db.select().from(rateLimitPolicies).where(and(eq(rateLimitPolicies.isEnabled, true), or(and(eq(rateLimitPolicies.scope, "user"), eq(rateLimitPolicies.subject, String(userId))), ...(ipAddress ? [and(eq(rateLimitPolicies.scope, "ip"), eq(rateLimitPolicies.subject, ipAddress))] : []))));
  const userPolicy = policyRows.find(policy => policy.scope === "user");
  const ipPolicy = policyRows.find(policy => policy.scope === "ip");
  const effective = { ...setting, requestsPerMinute: userPolicy?.requestsPerMinute ?? setting.requestsPerMinute, tokensPerMinute: userPolicy?.tokensPerMinute ?? setting.tokensPerMinute, ipRequestsPerMinute: ipPolicy?.requestsPerMinute ?? setting.ipRequestsPerMinute };
  const limit = effective;
  const since = new Date(Date.now() - 60_000);
  const result = await getDb().execute(sql`SELECT COUNT(*)::int AS requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int AS tokens FROM request_logs WHERE user_id = ${userId} AND created_at >= ${since}`);
  const row = (result as unknown as { requests?: number; tokens?: number }[])[0] ?? {};
  const ipResult = ipAddress ? await getDb().execute(sql`SELECT COUNT(*)::int AS requests FROM request_logs WHERE ip_address = ${ipAddress} AND created_at >= ${since}`) : [];
  const ipRequests = Number((ipResult as unknown as { requests?: number }[])[0]?.requests ?? 0);
  return { allowed: Number(row.requests ?? 0) < effective.requestsPerMinute && Number(row.tokens ?? 0) < effective.tokensPerMinute && ipRequests < effective.ipRequestsPerMinute, limit, reason: "rate_limit" };
}

export async function isAccessBanned(userId: number, email: string, ipAddress?: string) {
  const domain = email.split("@")[1] ?? "";
  const clauses = [and(eq(accessBans.scope, "user"), eq(accessBans.value, String(userId))), and(eq(accessBans.scope, "email_domain"), eq(accessBans.value, domain))];
  if (ipAddress) clauses.push(and(eq(accessBans.scope, "ip"), eq(accessBans.value, ipAddress)));
  const ban = (await getDb().select({ id: accessBans.id }).from(accessBans).where(and(eq(accessBans.isActive, true), or(...clauses))).limit(1))[0];
  return Boolean(ban);
}

export async function getAnalytics(userId: number) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
  const result = await getDb().execute(sql`SELECT TO_CHAR(day, 'Mon DD') AS day, requests, (input_tokens + output_tokens)::int AS tokens, CASE WHEN requests > 0 THEN ROUND(total_latency_ms::numeric / requests)::int ELSE 0 END AS latency, CASE WHEN requests > 0 THEN ROUND(100.0 * error_count / requests, 1) ELSE 0 END AS error_rate FROM usage_daily WHERE user_id = ${userId} AND day >= ${since.toISOString().slice(0, 10)}::date ORDER BY day`);
  return queryRows<{ day: string; requests: number; tokens: number; latency: number; error_rate: number }>(result);
}

export async function getOverview(userId: number) {
  const [keys, analytics] = await Promise.all([listApiKeys(userId), getAnalytics(userId)]);
  const totals = analytics.reduce((acc, item) => ({ requests: acc.requests + Number(item.requests), tokens: acc.tokens + Number(item.tokens), latencyTotal: acc.latencyTotal + Number(item.latency) * Number(item.requests), errors: acc.errors + Number(item.error_rate) * Number(item.requests) / 100 }), { requests: 0, tokens: 0, latencyTotal: 0, errors: 0 });
  return { activeKeys: keys.filter(key => key.isActive).length, requests: totals.requests, tokens: totals.tokens, averageLatency: totals.requests ? Math.round(totals.latencyTotal / totals.requests) : 0, errorRate: totals.requests ? Number((100 * totals.errors / totals.requests).toFixed(1)) : 0, series: analytics };
}

export async function listUsers(input: { search?: string; status?: "all" | "active" | "disabled"; limit?: number; offset?: number } = {}) {
  const search = input.search?.trim() ?? "";
  const statusClause = input.status === "active" ? sql`AND u.is_disabled = false` : input.status === "disabled" ? sql`AND u.is_disabled = true` : sql``;
  const result = await getDb().execute(sql`SELECT u.id, u.name, u.email, u.role, u.is_disabled AS "isDisabled", u.email_verified_at AS "emailVerifiedAt", u.stipend_credits AS "stipendCredits", u.purchased_credits AS "purchasedCredits", u.created_at AS "createdAt", (SELECT COUNT(*)::int FROM api_keys k WHERE k.user_id = u.id AND k.is_active = true) AS "activeKeys", (SELECT COUNT(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS "activeSessions", (SELECT COUNT(*)::int FROM request_logs r WHERE r.user_id = u.id AND r.created_at >= NOW() - INTERVAL '24 hours') AS "requests24h" FROM users u WHERE (${search} = '' OR u.email ILIKE '%' || ${search} || '%' OR u.name ILIKE '%' || ${search} || '%') ${statusClause} ORDER BY u.created_at DESC LIMIT ${Math.min(input.limit ?? 100, 500)} OFFSET ${Math.max(input.offset ?? 0, 0)}`);
  return queryRows(result);
}

export async function listAdminUserSessions(userId: number) {
  return queryRows(await getDb().execute(sql`SELECT s.id, s.user_id AS "userId", s.expires_at AS "expiresAt", s.created_at AS "createdAt" FROM sessions s WHERE s.user_id = ${userId} ORDER BY s.created_at DESC LIMIT 100`));
}

export async function listAdminUserUsage(userId: number) {
  return queryRows(await getDb().execute(sql`SELECT model_slug AS "modelSlug", status, COUNT(*)::int AS requests, COALESCE(SUM(input_tokens), 0)::int AS "inputTokens", COALESCE(SUM(output_tokens), 0)::int AS "outputTokens", ROUND(AVG(latency_ms))::int AS "avgLatencyMs", MAX(created_at) AS "lastRequestAt" FROM request_logs WHERE user_id = ${userId} GROUP BY model_slug, status ORDER BY "lastRequestAt" DESC LIMIT 200`));
}

export async function listAdminUserLedger(userId: number) {
  return queryRows(await getDb().execute(sql`SELECT id, amount, entry_type AS "entryType", bucket, description, expires_at AS "expiresAt", created_at AS "createdAt" FROM credit_ledger WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 200`));
}

export async function listAdminRequestLogs(input: { userId?: number; modelSlug?: string; status?: "success" | "error"; from?: string; to?: string; limit?: number } = {}) {
  const result = await getDb().execute(sql`SELECT id, user_id AS "userId", api_key_id AS "apiKeyId", model_slug AS "modelSlug", status, input_tokens AS "inputTokens", output_tokens AS "outputTokens", latency_ms AS "latencyMs", error_code AS "errorCode", ip_address AS "ipAddress", created_at AS "createdAt" FROM request_logs WHERE (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null}) AND (${input.modelSlug ?? null} IS NULL OR model_slug = ${input.modelSlug ?? null}) AND (${input.status ?? null} IS NULL OR status = ${input.status ?? null}) AND (${input.from ?? null} IS NULL OR created_at >= ${input.from ?? null}::timestamptz) AND (${input.to ?? null} IS NULL OR created_at < ${input.to ?? null}::timestamptz + INTERVAL '1 day') ORDER BY created_at DESC LIMIT ${Math.min(input.limit ?? 200, 500)}`);
  return queryRows(result);
}

export async function listAdminSecurityEvents(input: { userId?: number; targetUserId?: number; eventType?: string; from?: string; to?: string; limit?: number } = {}) {
  const result = await getDb().execute(sql`SELECT id::text AS id, event_type AS "eventType", user_id AS "userId", ip_address AS "ipAddress", metadata, created_at AS "createdAt" FROM security_events WHERE (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null}) AND (${input.targetUserId ?? null} IS NULL OR metadata->>'targetUserId' = ${input.targetUserId == null ? null : String(input.targetUserId)}) AND (${input.eventType ?? null} IS NULL OR event_type = ${input.eventType ?? null}) AND (${input.from ?? null} IS NULL OR created_at >= ${input.from ?? null}::timestamptz) AND (${input.to ?? null} IS NULL OR created_at < ${input.to ?? null}::timestamptz + INTERVAL '1 day') ORDER BY created_at DESC LIMIT ${Math.min(input.limit ?? 200, 500)}`);
  return queryRows(result);
}

export async function revokeAllUserApiKeys(userId: number) {
  return getDb().update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
}

export async function setUserDisabled(id: number, isDisabled: boolean) {
  return (await getDb().update(users).set({ isDisabled, updatedAt: new Date() }).where(eq(users.id, id)).returning())[0];
}

export async function listRateLimitPolicies() {
  return getDb().select().from(rateLimitPolicies).orderBy(rateLimitPolicies.scope, rateLimitPolicies.subject);
}

export async function saveRateLimitPolicy(input: { scope: string; subject: string; requestsPerMinute: number; tokensPerMinute: number; isEnabled: boolean }) {
  const existing = (await getDb().select({ id: rateLimitPolicies.id }).from(rateLimitPolicies).where(and(eq(rateLimitPolicies.scope, input.scope), eq(rateLimitPolicies.subject, input.subject))).limit(1))[0];
  if (existing) return (await getDb().update(rateLimitPolicies).set({ ...input, updatedAt: new Date() }).where(eq(rateLimitPolicies.id, existing.id)).returning())[0]!;
  return (await getDb().insert(rateLimitPolicies).values(input).returning())[0]!;
}

export async function setRateLimitPolicyEnabled(id: number, isEnabled: boolean) {
  return (await getDb().update(rateLimitPolicies).set({ isEnabled, updatedAt: new Date() }).where(eq(rateLimitPolicies.id, id)).returning())[0];
}

export async function getRateLimitSettings() {
  return (await getDb().select().from(rateLimitSettings).limit(1))[0] ?? { id: 0, requestsPerMinute: 20, tokensPerMinute: 10000, updatedAt: new Date() };
}

export async function saveRateLimits(input: { requestsPerMinute: number; tokensPerMinute: number }) {
  const existing = (await getDb().select().from(rateLimitSettings).limit(1))[0];
  if (existing) return (await getDb().update(rateLimitSettings).set({ ...input, updatedAt: new Date() }).where(eq(rateLimitSettings.id, existing.id)).returning())[0]!;
  return (await getDb().insert(rateLimitSettings).values(input).returning())[0]!;
}

export async function seedDemoData(adminId: number) {
  const db = getDb();
  const providerSeeds = [{ slug: "openai", displayName: "OpenAI", baseUrl: "https://api.openai.com/v1" }, { slug: "groq", displayName: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, { slug: "anthropic", displayName: "Anthropic", baseUrl: "https://api.anthropic.com/v1" }];
  for (const provider of providerSeeds) await db.insert(providers).values({ ...provider, isEnabled: true }).onConflictDoNothing();
  const providerRows = await db.select().from(providers);
  const idBySlug = new Map(providerRows.map(provider => [provider.slug, provider.id]));
  const modelSeeds = [{ slug: "kiwi/gpt-4o-mini", displayName: "GPT-4o mini", provider: "openai", upstreamId: "gpt-4o-mini", contextWindow: 128000, inputPrice: "0.15", outputPrice: "0.60" }, { slug: "kiwi/llama-3.3-70b", displayName: "Llama 3.3 70B", provider: "groq", upstreamId: "llama-3.3-70b-versatile", contextWindow: 128000, inputPrice: "0.59", outputPrice: "0.79" }, { slug: "kiwi/claude-sonnet", displayName: "Claude Sonnet", provider: "anthropic", upstreamId: "claude-3-5-sonnet-latest", contextWindow: 200000, inputPrice: "3.00", outputPrice: "15.00" }];
  for (const model of modelSeeds) { const providerId = idBySlug.get(model.provider); if (providerId) await db.insert(models).values({ ...model, providerId, routingConfig: { protocol: "openai" } }).onConflictDoNothing(); }
  await saveRateLimits({ requestsPerMinute: 20, tokensPerMinute: 10000 });
  const existing = await db.execute(sql`SELECT COUNT(*)::int AS count FROM request_logs WHERE user_id = ${adminId}`);
  if (Number((existing as unknown as { count?: number }[])[0]?.count ?? 0) === 0) {
    const seedKey = await createApiKey(adminId, "Seed telemetry");
    for (let day = 13; day >= 0; day -= 1) await logRequest({ userId: adminId, apiKeyId: seedKey.id, modelSlug: day % 2 ? "kiwi/gpt-4o-mini" : "kiwi/llama-3.3-70b", status: day === 5 ? "error" : "success", inputTokens: 420 + day * 37, outputTokens: 160 + day * 12, latencyMs: 380 + day * 14, errorCode: day === 5 ? "upstream_timeout" : undefined, createdAt: new Date(Date.now() - day * 86_400_000) });
  }
}

export async function getCreditEconomy() {
  const totals = await getDb().execute(sql`SELECT COALESCE(SUM(stipend_credits + purchased_credits), 0)::numeric AS circulating, COUNT(*)::int AS users FROM users WHERE is_disabled = false`);
  const burn = await getDb().execute(sql`SELECT COALESCE(SUM(-amount), 0)::numeric AS daily_burn FROM credit_ledger WHERE entry_type = 'spend' AND created_at >= NOW() - INTERVAL '24 hours'`);
  const spenders = await getDb().execute(sql`SELECT u.id, u.name, u.email, COALESCE(SUM(-l.amount), 0)::numeric AS spent FROM users u LEFT JOIN credit_ledger l ON l.user_id = u.id AND l.entry_type = 'spend' AND l.created_at >= NOW() - INTERVAL '24 hours' GROUP BY u.id ORDER BY spent DESC LIMIT 8`);
  return { circulating: Number((totals as unknown as { circulating?: string }[])[0]?.circulating ?? 0), users: Number((totals as unknown as { users?: number }[])[0]?.users ?? 0), dailyBurn: Number((burn as unknown as { daily_burn?: string }[])[0]?.daily_burn ?? 0), topSpenders: spenders as unknown as { id: number; name: string; email: string; spent: string }[] };
}

export async function listAnnouncements(activeOnly = true) {
  const query = getDb().select().from(announcements);
  return activeOnly ? query.where(eq(announcements.isActive, true)).orderBy(desc(announcements.createdAt)) : query.orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(input: { message: string; kind: string; creditsPerUser: number; createdBy: number }) {
  const announcement = (await getDb().insert(announcements).values({ message: input.message, kind: input.kind, creditsPerUser: input.creditsPerUser.toFixed(3), createdBy: input.createdBy }).returning())[0]!;
  return announcement;
}

export async function setAnnouncementActive(id: number, isActive: boolean) {
  return (await getDb().update(announcements).set({ isActive }).where(eq(announcements.id, id)).returning())[0];
}

export async function getUserForensics(userId: number) {
  const user = (await getDb().select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return null;
  const [ledger, logs, logins, keys] = await Promise.all([
    getDb().select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(1000),
    getDb().select().from(requestLogs).where(eq(requestLogs.userId, userId)).orderBy(desc(requestLogs.createdAt)).limit(1000),
    getDb().select().from(loginRecords).where(eq(loginRecords.userId, userId)).orderBy(desc(loginRecords.createdAt)).limit(100),
    listApiKeys(userId),
  ]);
  return { user, ledger, logs, logins, keys };
}

export async function recordLogin(userId: number, ipAddress?: string, userAgentHash?: string) {
  await getDb().insert(loginRecords).values({ userId, ipAddress, userAgentHash });
}

export async function setGlobalApiEnabled(globalApiEnabled: boolean) {
  const existing = (await getDb().select().from(rateLimitSettings).limit(1))[0];
  if (existing) return (await getDb().update(rateLimitSettings).set({ globalApiEnabled, updatedAt: new Date() }).where(eq(rateLimitSettings.id, existing.id)).returning())[0]!;
  return (await getDb().insert(rateLimitSettings).values({ globalApiEnabled }).returning())[0]!;
}

export async function setStripeCustomerId(userId: number, stripeCustomerId: string) {
  await getDb().update(users).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function previewProviderModels(providerId: number) {
  const provider = (await getDb().select().from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  if (provider.slug === "anthropic" || provider.slug === "gemini") return { ok: true, mode: "manual" as const, statusCode: null, detail: "This provider uses manual model routes", models: [] as Array<{ upstreamId: string; displayName: string; alreadyExists: boolean }> };
  const activeCredential = await resolveProviderCredential(providerId);
  if (!activeCredential) return { ok: false, mode: "automatic" as const, statusCode: null, detail: "Configure an upstream provider key before discovery", models: [] as Array<{ upstreamId: string; displayName: string; alreadyExists: boolean }> };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${decryptSecret(activeCredential.encryptedApiKey)}` }, signal: controller.signal });
    if (!response.ok) return { ok: false, mode: "automatic" as const, statusCode: response.status, detail: "Provider rejected model discovery", models: [] as Array<{ upstreamId: string; displayName: string; alreadyExists: boolean }> };
    const payload = await response.json() as { data?: unknown };
    const discovered = Array.isArray(payload.data) ? payload.data.filter((item): item is { id: string } => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string" && Boolean((item as { id: string }).id)) : [];
    const unique = Array.from(new Map(discovered.map(item => [item.id, item])).values());
    const existing = await getDb().select({ upstreamId: models.upstreamId }).from(models).where(eq(models.providerId, provider.id));
    const existingIds = new Set(existing.map(item => item.upstreamId));
    return { ok: true, mode: "automatic" as const, statusCode: response.status, detail: "Catalog preview ready", models: unique.map(item => ({ upstreamId: item.id, displayName: item.id, alreadyExists: existingIds.has(item.id) })) };
  } catch { return { ok: false, mode: "automatic" as const, statusCode: null, detail: "Provider did not complete model discovery", models: [] as Array<{ upstreamId: string; displayName: string; alreadyExists: boolean }> }; }
  finally { clearTimeout(timeout); }
}

export async function syncProviderModels(providerId: number) {
  const provider = (await getDb().select().from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  if (provider.slug === "anthropic" || provider.slug === "gemini") return { discovered: 0, mode: "manual" as const, ok: true, statusCode: null, detail: "This provider uses manual model routes" };
  const activeCredential = await resolveProviderCredential(providerId);
  if (!activeCredential) return { discovered: 0, mode: "automatic" as const, ok: false, statusCode: null, detail: "Configure an upstream provider key before discovery" };

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${decryptSecret(activeCredential.encryptedApiKey)}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      await getDb().update(providers).set({ isHealthy: false, updatedAt: new Date() }).where(eq(providers.id, provider.id));
      return { discovered: 0, mode: "automatic" as const, ok: false, statusCode: response.status, detail: "Provider rejected model discovery" };
    }
    const payload = await response.json() as { data?: unknown };
    const discovered = Array.isArray(payload.data) ? payload.data.filter((item): item is { id: string } => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string" && Boolean((item as { id: string }).id)) : [];
    for (const item of discovered) {
      const upstreamId = item.id;
      const slug = `kiwi/${provider.slug}-${upstreamId.replace(/[^a-zA-Z0-9._-]/g, "-")}`.slice(0, 120);
      await getDb().insert(models).values({ slug, displayName: upstreamId, providerId: provider.id, upstreamId, contextWindow: 128000, inputPrice: "0", outputPrice: "0", creditCostPer1kTokens: "1", routingConfig: { protocol: "openai", discovered: true }, isEnabled: false }).onConflictDoNothing();
    }
    await getDb().update(providers).set({ isHealthy: true, updatedAt: new Date() }).where(eq(providers.id, provider.id));
    return { discovered: discovered.length, mode: "automatic" as const, ok: true, statusCode: response.status, latencyMs: Date.now() - startedAt, detail: "Model catalog synchronized" };
  } catch {
    await getDb().update(providers).set({ isHealthy: false, updatedAt: new Date() }).where(eq(providers.id, provider.id));
    return { discovered: 0, mode: "automatic" as const, ok: false, statusCode: null, latencyMs: Date.now() - startedAt, detail: "Provider did not complete model discovery" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Performs a non-billable credential and catalog handshake without exposing upstream response details. */
export async function testProviderConnection(providerId: number) {
  const provider = (await getDb().select().from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  const activeCredential = await resolveProviderCredential(providerId);
  if (!activeCredential) return { ok: false, latencyMs: 0, statusCode: null, detail: "No encrypted credential is configured" };
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const root = provider.baseUrl.replace(/\/$/, "");
    const response = await fetch(`${root}/models`, {
      headers: provider.slug === "anthropic"
        ? { "x-api-key": decryptSecret(activeCredential.encryptedApiKey), "anthropic-version": "2023-06-01" }
        : { Authorization: `Bearer ${decryptSecret(activeCredential.encryptedApiKey)}` },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const ok = response.ok;
    await getDb().update(providers).set({ isHealthy: ok, updatedAt: new Date() }).where(eq(providers.id, provider.id));
    return { ok, latencyMs, statusCode: response.status, detail: ok ? "Catalog handshake succeeded" : "Provider rejected the catalog handshake" };
  } catch {
    const latencyMs = Date.now() - startedAt;
    await getDb().update(providers).set({ isHealthy: false, updatedAt: new Date() }).where(eq(providers.id, provider.id));
    return { ok: false, latencyMs, statusCode: null, detail: "Provider did not complete the catalog handshake" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Performs a non-billable model-route handshake by checking the provider catalog for the configured upstream ID. */
export async function testModelRoute(modelId: number) {
  const route = (await getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id)).where(eq(models.id, modelId)).limit(1))[0];
  if (!route) throw new Error("Model route not found");
  const activeCredential = await resolveProviderCredential(route.provider.id);
  if (!activeCredential) return { ok: false, statusCode: null, latencyMs: 0, detail: "No encrypted credential is configured", modelFound: false };
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${route.provider.baseUrl.replace(/\/$/, "")}/models`, { headers: route.provider.slug === "anthropic" ? { "x-api-key": decryptSecret(activeCredential.encryptedApiKey), "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${decryptSecret(activeCredential.encryptedApiKey)}` }, signal: controller.signal });
    const payload = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
    const modelFound = Boolean(payload?.data?.some(item => item.id === route.model.upstreamId));
    return { ok: response.ok && modelFound, statusCode: response.status, latencyMs: Date.now() - startedAt, detail: response.ok ? modelFound ? "Configured model is present in the provider catalog" : "Provider catalog does not contain this upstream model" : "Provider rejected the catalog handshake", modelFound };
  } catch {
    return { ok: false, statusCode: null, latencyMs: Date.now() - startedAt, detail: "Provider did not complete the model handshake", modelFound: false };
  } finally { clearTimeout(timeout); }
}
/** Runs a founder sample request without user-credit deduction or normal gateway request logging. */
export async function testModelSample(modelId: number, prompt: string) {
  const route = (await getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id)).where(eq(models.id, modelId)).limit(1))[0];
  if (!route) throw new Error("Model route not found");
  const activeCredential = await resolveProviderCredential(route.provider.id);
  if (!activeCredential) return { ok: false, statusCode: null, latencyMs: 0, detail: "No encrypted credential is configured", preview: "" };
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const routing = (route.model.routingConfig ?? {}) as { protocol?: "openai" | "anthropic" | "gemini"; headers?: Record<string, string> };
    const protocol = routing.protocol ?? route.provider.protocol ?? (route.provider.slug === "anthropic" ? "anthropic" : "openai");
    const isAnthropic = protocol === "anthropic";
    const headers = isAnthropic ? { "Content-Type": "application/json", "x-api-key": decryptSecret(activeCredential.encryptedApiKey), "anthropic-version": "2023-06-01", ...(route.provider.requestHeaders ?? {}), ...(routing.headers ?? {}) } : { "Content-Type": "application/json", Authorization: `Bearer ${decryptSecret(activeCredential.encryptedApiKey)}`, ...(route.provider.requestHeaders ?? {}), ...(routing.headers ?? {}) };
    const body = isAnthropic ? { model: route.model.upstreamId, max_tokens: 256, stream: false, messages: [{ role: "user", content: prompt }] } : { model: route.model.upstreamId, messages: [{ role: "user", content: prompt }], max_tokens: 256, stream: false };
    const response = await fetch(`${route.provider.baseUrl.replace(/\/$/, "")}${isAnthropic ? "/messages" : "/chat/completions"}`, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => null) as any;
    const preview = isAnthropic ? String(payload?.content?.filter((part: any) => part.type === "text").map((part: any) => part.text).join("") ?? "").slice(0, 1000) : String(payload?.choices?.[0]?.message?.content ?? "").slice(0, 1000);
    return { ok: response.ok, statusCode: response.status, latencyMs: Date.now() - startedAt, detail: response.ok ? "Sample completed without charging Kiwi Credits or recording normal usage" : "Provider rejected the founder sample request", preview };
  } catch {
    return { ok: false, statusCode: null, latencyMs: Date.now() - startedAt, detail: "Provider did not complete the founder sample request", preview: "" };
  } finally { clearTimeout(timeout); }
}
/** Archives a provider safely by disabling it and every attached route without deleting audit history. */
export async function archiveProvider(providerId: number) {
  const db = getDb();
  const provider = (await db.select({ id: providers.id }).from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  await db.update(models).set({ isEnabled: false, updatedAt: new Date() }).where(eq(models.providerId, providerId));
  return (await db.update(providers).set({ isEnabled: false, isHealthy: false, updatedAt: new Date() }).where(eq(providers.id, providerId)).returning())[0]!;
}

/** Archives a model route by disabling it, retaining its historic usage and ledger references. */
export async function archiveModel(modelId: number) {
  const saved = (await getDb().update(models).set({ isEnabled: false, updatedAt: new Date() }).where(eq(models.id, modelId)).returning())[0];
  if (!saved) throw new Error("Model not found");
  return saved;
}

export async function restoreModel(modelId: number) {
  const saved = (await getDb().update(models).set({ isEnabled: true, updatedAt: new Date() }).where(eq(models.id, modelId)).returning())[0];
  if (!saved) throw new Error("Model not found");
  return saved;
}

export async function banUserAccess(userId: number, founderId: number, reason: string) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("User not found");
  if (isFounderEmail(user.email) || user.role === "founder") throw new Error("The founder account is immutable");
  await db.update(users).set({ isDisabled: true, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(eq(apiKeys.userId, userId));
  const domain = user.email.split("@")[1] ?? "";
  await db.insert(accessBans).values({ scope: "user", value: String(userId), reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  if (domain) await db.insert(accessBans).values({ scope: "email_domain", value: domain, reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  const lastIp = (await db.select({ ipAddress: loginRecords.ipAddress }).from(loginRecords).where(and(eq(loginRecords.userId, userId), isNotNull(loginRecords.ipAddress))).orderBy(desc(loginRecords.createdAt)).limit(1))[0]?.ipAddress;
  if (lastIp) await db.insert(accessBans).values({ scope: "ip", value: lastIp, reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  return user;
}

export async function banIpAddress(ipAddress: string, reason: string) {
  if (!ipAddress) return;
  await getDb().insert(accessBans).values({ scope: "ip", value: ipAddress, reason }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason } });
}

export async function createAuthToken(input: { userId: number; email: string; purpose: "email_verify" | "password_reset"; requestIp?: string; expiresInMs: number }) {
  const rawToken = randomBytes(32).toString("base64url");
  const email = normalizeEmail(input.email);
  const tokenHash = hashApiKey(rawToken);
  await getDb().update(authTokens).set({ consumedAt: new Date() }).where(and(eq(authTokens.email, email), eq(authTokens.purpose, input.purpose), isNull(authTokens.consumedAt)));
  await getDb().insert(authTokens).values({ userId: input.userId, email, purpose: input.purpose, tokenHash, requestIp: input.requestIp, expiresAt: new Date(Date.now() + input.expiresInMs) });
  return rawToken;
}

export async function consumeAuthToken(input: { rawToken: string; purpose: "email_verify" | "password_reset" }) {
  const now = new Date();
  return (await getDb().update(authTokens).set({ consumedAt: now }).where(and(eq(authTokens.tokenHash, hashApiKey(input.rawToken)), eq(authTokens.purpose, input.purpose), isNull(authTokens.consumedAt), gte(authTokens.expiresAt, now))).returning())[0];
}

export async function createEmailOutbox(input: { userId?: number; to: string; purpose: "email_verify" | "password_reset"; subject: string; html: string }) {
  const row = (await getDb().insert(emailOutbox).values({ userId: input.userId, email: normalizeEmail(input.to), purpose: input.purpose, subject: input.subject, bodyHtml: input.html }).returning({ id: emailOutbox.id }))[0];
  if (!row) throw new Error("Unable to create transactional email outbox record");
  return row;
}

export async function takeRateLimit(input: { scope: string; subject: string; maxHits: number; windowMs: number }) {
  const windowStart = new Date(Math.floor(Date.now() / input.windowMs) * input.windowMs);
  const result = await getDb().insert(rateLimitBuckets).values({ scope: input.scope.slice(0, 50), subject: input.subject.slice(0, 320), windowStart, hits: 1, updatedAt: new Date() }).onConflictDoUpdate({ target: [rateLimitBuckets.scope, rateLimitBuckets.subject, rateLimitBuckets.windowStart], set: { hits: sql`${rateLimitBuckets.hits} + 1`, updatedAt: new Date() } }).returning({ hits: rateLimitBuckets.hits });
  const hits = result[0]?.hits ?? input.maxHits + 1;
  return { allowed: hits <= input.maxHits, remaining: Math.max(0, input.maxHits - hits), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + input.windowMs - Date.now()) / 1000)) };
}

export async function recordSecurityEvent(input: { eventType: string; userId?: number; ipAddress?: string; metadata?: Record<string, unknown> }) {
  await getDb().insert(securityEvents).values({ userId: input.userId, eventType: input.eventType.slice(0, 80), ipAddress: input.ipAddress, metadata: input.metadata ?? {} });
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

async function getCreditBalanceSummary(userId: number) {
  const user = (await getDb().select({ stipend: users.stipendCredits, purchased: users.purchasedCredits }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("User not found");
  const stipend = Number(user.stipend);
  const purchased = Number(user.purchased);
  return { stipend, purchased, total: stipend + purchased };
}

export async function createCouponCode(input: { code: string; creditsAmount: number; maxUses?: number; expiresAt?: Date; createdBy: number }) {
  const code = normalizeCouponCode(input.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{3,63}$/.test(code)) throw new Error("Coupon code must use 4–64 uppercase letters, numbers, hyphens, or underscores");
  return (await getDb().insert(couponCodes).values({
    code,
    creditsAmount: input.creditsAmount.toFixed(3),
    maxUses: input.maxUses,
    expiresAt: input.expiresAt,
    createdBy: input.createdBy,
  }).returning())[0]!;
}

export async function listCouponCodes() {
  const [coupons, redemptionCounts] = await Promise.all([
    getDb().select().from(couponCodes).orderBy(desc(couponCodes.createdAt)),
    getDb().execute(sql`SELECT coupon_id, COUNT(*)::int AS redemptions FROM coupon_redemptions GROUP BY coupon_id`),
  ]);
  const counts = new Map(queryRows<{ coupon_id: number; redemptions: number }>(redemptionCounts).map(row => [Number(row.coupon_id), Number(row.redemptions)]));
  return coupons.map(coupon => ({ ...coupon, redemptions: counts.get(coupon.id) ?? 0 }));
}

export async function deactivateCouponCode(id: number) {
  return (await getDb().update(couponCodes).set({ isActive: false, updatedAt: new Date() }).where(and(eq(couponCodes.id, id), eq(couponCodes.isActive, true))).returning({ id: couponCodes.id }))[0] !== undefined;
}

export async function redeemCouponCode(input: { userId: number; code: string; ipHash: string }) {
  const code = normalizeCouponCode(input.code);
  const coupon = (await getDb().select({ id: couponCodes.id }).from(couponCodes).where(eq(couponCodes.code, code)).limit(1))[0];
  if (!coupon) return { redeemed: false as const, reason: "invalid" as const };
  const result = await getDb().execute(sql`
    WITH eligible_coupon AS (
      SELECT id, credits_amount FROM coupon_codes
      WHERE code = ${code} AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      FOR UPDATE
    ), redemption AS (
      INSERT INTO coupon_redemptions (coupon_id, user_id, ip_hash)
      SELECT id, ${input.userId}, ${input.ipHash} FROM eligible_coupon
      ON CONFLICT DO NOTHING
      RETURNING id, coupon_id
    ), coupon_updated AS (
      UPDATE coupon_codes c SET uses_count = c.uses_count + 1, updated_at = NOW()
      FROM redemption r WHERE c.id = r.coupon_id
      RETURNING c.id
    ), credit_entry AS (
      INSERT INTO credit_ledger (user_id, amount, entry_type, bucket, description, expires_at)
      SELECT ${input.userId}, ec.credits_amount, 'airdrop'::credit_entry_type, 'stipend'::credit_bucket,
        ${`Coupon ${code} redemption`}, NOW() + INTERVAL '30 days'
      FROM eligible_coupon ec INNER JOIN redemption r ON r.coupon_id = ec.id
      RETURNING id, user_id, amount
    ), balance_updated AS (
      UPDATE users u SET stipend_credits = u.stipend_credits + ce.amount, updated_at = NOW()
      FROM credit_entry ce WHERE u.id = ce.user_id
      RETURNING u.id
    ), redemption_linked AS (
      UPDATE coupon_redemptions cr SET ledger_entry_id = ce.id
      FROM credit_entry ce WHERE cr.coupon_id = ${coupon.id} AND cr.user_id = ${input.userId} AND cr.ip_hash = ${input.ipHash}
      RETURNING cr.id
    )
    SELECT ce.amount FROM credit_entry ce
  `);
  const row = queryRows<{ amount: string }>(result)[0];
  if (!row) return { redeemed: false as const, reason: "ineligible" as const };
  return { redeemed: true as const, amount: Number(row.amount), summary: await getCreditBalanceSummary(input.userId) };
}

export async function createPendingReferral(input: { referrerCode: string; referredUserId: number; signupIpHash: string; deviceHash?: string }) {
  const referralCode = input.referrerCode.trim().toUpperCase();
  const referrer = (await getDb().select({ id: users.id }).from(users).where(and(eq(users.referralCode, referralCode), eq(users.isDisabled, false), isNotNull(users.emailVerifiedAt))).limit(1))[0];
  if (!referrer || referrer.id === input.referredUserId) return { created: false as const, reason: "invalid" as const };
  const inserted = await getDb().insert(referrals).values({
    referrerUserId: referrer.id,
    referredUserId: input.referredUserId,
    referralCode,
    signupIpHash: input.signupIpHash,
    deviceHash: input.deviceHash,
    referrerRewardCredits: "25.000",
    referredRewardCredits: "10.000",
  }).onConflictDoNothing().returning({ id: referrals.id });
  return inserted[0] ? { created: true as const } : { created: false as const, reason: "risk_control" as const };
}

export async function activateReferralForVerifiedUser(userId: number) {
  const result = await getDb().execute(sql`
    WITH eligible AS (
      SELECT r.id, r.referred_reward_credits
      FROM referrals r INNER JOIN users referrer ON referrer.id = r.referrer_user_id
      WHERE r.referred_user_id = ${userId} AND r.status = 'pending'::referral_status
        AND r.referrer_user_id <> ${userId} AND referrer.is_disabled = false AND referrer.email_verified_at IS NOT NULL
      FOR UPDATE
    ), activated AS (
      UPDATE referrals r SET status = 'activated'::referral_status, activated_at = NOW()
      FROM eligible e WHERE r.id = e.id
      RETURNING r.id, r.referred_user_id, r.referred_reward_credits
    ), credit_entry AS (
      INSERT INTO credit_ledger (user_id, amount, entry_type, bucket, description, expires_at)
      SELECT referred_user_id, referred_reward_credits, 'airdrop'::credit_entry_type, 'stipend'::credit_bucket,
        'Referral activation reward', NOW() + INTERVAL '30 days'
      FROM activated
      RETURNING id, user_id, amount
    ), balance_updated AS (
      UPDATE users u SET stipend_credits = u.stipend_credits + ce.amount, updated_at = NOW()
      FROM credit_entry ce WHERE u.id = ce.user_id
      RETURNING u.id
    ), referral_linked AS (
      UPDATE referrals r SET referred_reward_claimed_at = NOW(), referred_ledger_entry_id = ce.id
      FROM activated a INNER JOIN credit_entry ce ON ce.user_id = a.referred_user_id
      WHERE r.id = a.id
      RETURNING r.id
    )
    SELECT ce.amount FROM credit_entry ce
  `);
  const row = queryRows<{ amount: string }>(result)[0];
  return row ? { activated: true as const, amount: Number(row.amount) } : { activated: false as const };
}

export async function claimReferralRewards(userId: number) {
  const result = await getDb().execute(sql`
    WITH eligible AS (
      SELECT id, referrer_reward_credits FROM referrals
      WHERE referrer_user_id = ${userId} AND status = 'activated'::referral_status AND referrer_reward_claimed_at IS NULL
      FOR UPDATE
    ), credit_entry AS (
      INSERT INTO credit_ledger (user_id, amount, entry_type, bucket, description, expires_at)
      SELECT ${userId}, SUM(referrer_reward_credits), 'airdrop'::credit_entry_type, 'stipend'::credit_bucket,
        'Referral reward claim', NOW() + INTERVAL '30 days'
      FROM eligible HAVING COUNT(*) > 0
      RETURNING id, user_id, amount
    ), balance_updated AS (
      UPDATE users u SET stipend_credits = u.stipend_credits + ce.amount, updated_at = NOW()
      FROM credit_entry ce WHERE u.id = ce.user_id
      RETURNING u.id
    ), referrals_claimed AS (
      UPDATE referrals r SET referrer_reward_claimed_at = NOW(), referrer_ledger_entry_id = ce.id
      FROM eligible e CROSS JOIN credit_entry ce WHERE r.id = e.id
      RETURNING r.id
    )
    SELECT ce.amount, (SELECT COUNT(*)::int FROM referrals_claimed) AS claims FROM credit_entry ce
  `);
  const row = queryRows<{ amount: string; claims: number }>(result)[0];
  return row ? { claimed: true as const, amount: Number(row.amount), referrals: Number(row.claims), summary: await getCreditBalanceSummary(userId) } : { claimed: false as const, amount: 0, referrals: 0, summary: await getCreditBalanceSummary(userId) };
}

export async function getReferralStats(userId: number) {
  const referralCode = await getOrCreateReferralCode(userId);
  const result = await getDb().execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending'::referral_status)::int AS pending,
      COUNT(*) FILTER (WHERE status = 'activated'::referral_status)::int AS activated,
      COUNT(*) FILTER (WHERE status = 'activated'::referral_status AND referrer_reward_claimed_at IS NULL)::int AS claimable,
      COALESCE(SUM(referrer_reward_credits) FILTER (WHERE status = 'activated'::referral_status AND referrer_reward_claimed_at IS NULL), 0)::numeric AS claimable_credits,
      COALESCE(SUM(referrer_reward_credits) FILTER (WHERE referrer_reward_claimed_at IS NOT NULL), 0)::numeric AS claimed_credits
    FROM referrals WHERE referrer_user_id = ${userId}
  `);
  const row = queryRows<{ total: number; pending: number; activated: number; claimable: number; claimable_credits: string; claimed_credits: string }>(result)[0] ?? { total: 0, pending: 0, activated: 0, claimable: 0, claimable_credits: "0", claimed_credits: "0" };
  return { referralCode, total: Number(row.total), pending: Number(row.pending), activated: Number(row.activated), claimable: Number(row.claimable), claimableCredits: Number(row.claimable_credits), claimedCredits: Number(row.claimed_credits) };
}

export async function getReferralProgramMetrics() {
  const result = await getDb().execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending'::referral_status)::int AS pending,
      COUNT(*) FILTER (WHERE status = 'activated'::referral_status)::int AS activated,
      COUNT(*) FILTER (WHERE status = 'rejected'::referral_status)::int AS rejected,
      COALESCE(SUM(referrer_reward_credits) FILTER (WHERE referrer_reward_claimed_at IS NOT NULL), 0)::numeric AS rewards_claimed
    FROM referrals
  `);
  const row = queryRows<{ total: number; pending: number; activated: number; rejected: number; rewards_claimed: string }>(result)[0] ?? { total: 0, pending: 0, activated: 0, rejected: 0, rewards_claimed: "0" };
  return { total: Number(row.total), pending: Number(row.pending), activated: Number(row.activated), rejected: Number(row.rejected), rewardsClaimed: Number(row.rewards_claimed) };
}
