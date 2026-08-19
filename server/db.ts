import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { accessBans, announcements, apiKeys, authTokens, creditLedger, loginRecords, models, providers, rateLimitBuckets, rateLimitSettings, requestLogs, securityEvents, sessions, usageDaily, users, type User } from "../drizzle/schema";
import { hashApiKey } from "./auth";
import { isFounderEmail, normalizeEmail } from "./founder";
import { decryptSecret } from "./crypto";

let database: ReturnType<typeof drizzle> | undefined;

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

export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  const email = normalizeEmail(input.email);
  return (await getDb().insert(users).values({ ...input, email, role: isFounderEmail(email) ? "founder" : "user" }).returning())[0]!;
}

export async function promoteFounderRecord() {
  return (await getDb().update(users).set({ role: "founder", isDisabled: false, updatedAt: new Date() }).where(eq(users.email, "indiasikhotechno@gmail.com")).returning())[0];
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
    passwordHash: users.passwordHash, role: users.role, isDisabled: users.isDisabled, emailVerifiedAt: users.emailVerifiedAt, emailVerificationSentAt: users.emailVerificationSentAt, failedLoginCount: users.failedLoginCount, lockedUntil: users.lockedUntil, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits, stripeCustomerId: users.stripeCustomerId, createdAt: users.createdAt, updatedAt: users.updatedAt,
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
  return getDb().select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastFour: apiKeys.lastFour, isActive: apiKeys.isActive, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(userId: number, id: string) {
  const result = await getDb().update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  return Boolean(result[0]);
}

export async function getApiKeyOwner(plainKey: string) {
  const result = await getDb().select({ apiKey: apiKeys, user: users }).from(apiKeys).innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, hashApiKey(plainKey)), eq(apiKeys.isActive, true), eq(users.isDisabled, false))).limit(1);
  if (!result[0]) return undefined;
  await getDb().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, result[0].apiKey.id));
  return result[0];
}

export async function listModels(enabledOnly = true) {
  const query = getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id));
  return enabledOnly ? query.where(and(eq(models.isEnabled, true), eq(providers.isEnabled, true))).orderBy(models.slug) : query.orderBy(models.slug);
}

export async function getGatewayRoute(slug: string) {
  return (await getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.slug, slug), eq(models.isEnabled, true), eq(providers.isEnabled, true))).limit(1))[0];
}

export async function createModel(input: { slug: string; displayName: string; providerId: number; upstreamId: string; contextWindow: number; inputPrice: string; outputPrice: string; isEnabled: boolean }) {
  return (await getDb().insert(models).values({ ...input, routingConfig: { protocol: "openai" } }).returning())[0]!;
}

export async function updateModel(id: number, input: { isEnabled?: boolean; displayName?: string; upstreamId?: string; creditCostPer1kTokens?: string }) {
  return (await getDb().update(models).set({ ...input, updatedAt: new Date() }).where(eq(models.id, id)).returning())[0];
}

export async function listProviders() {
  return getDb().select({ id: providers.id, slug: providers.slug, displayName: providers.displayName, baseUrl: providers.baseUrl, isHealthy: providers.isHealthy, isEnabled: providers.isEnabled, isConfigured: sql<boolean>`${providers.encryptedApiKey} IS NOT NULL` }).from(providers).orderBy(providers.displayName);
}

export async function saveProvider(input: { slug: string; displayName: string; baseUrl: string; encryptedApiKey?: string; isEnabled: boolean }) {
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
  const setting = (await getDb().select().from(rateLimitSettings).limit(1))[0] ?? { requestsPerMinute: 30, tokensPerMinute: 10000, ipRequestsPerMinute: 60, globalApiEnabled: true };
  if (!setting.globalApiEnabled) return { allowed: false, limit: setting, reason: "api_disabled" };
  const since = new Date(Date.now() - 60_000);
  const result = await getDb().execute(sql`SELECT COUNT(*)::int AS requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int AS tokens FROM request_logs WHERE user_id = ${userId} AND created_at >= ${since}`);
  const row = (result as unknown as { requests?: number; tokens?: number }[])[0] ?? {};
  const ipResult = ipAddress ? await getDb().execute(sql`SELECT COUNT(*)::int AS requests FROM request_logs WHERE ip_address = ${ipAddress} AND created_at >= ${since}`) : [];
  const ipRequests = Number((ipResult as unknown as { requests?: number }[])[0]?.requests ?? 0);
  return { allowed: Number(row.requests ?? 0) < setting.requestsPerMinute && Number(row.tokens ?? 0) < setting.tokensPerMinute && ipRequests < setting.ipRequestsPerMinute, limit: setting, reason: "rate_limit" };
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
  return await getDb().execute(sql`SELECT TO_CHAR(day, 'Mon DD') AS day, requests, (input_tokens + output_tokens)::int AS tokens, CASE WHEN requests > 0 THEN ROUND(total_latency_ms::numeric / requests)::int ELSE 0 END AS latency, CASE WHEN requests > 0 THEN ROUND(100.0 * error_count / requests, 1) ELSE 0 END AS error_rate FROM usage_daily WHERE user_id = ${userId} AND day >= ${since.toISOString().slice(0, 10)}::date ORDER BY day`) as unknown as { day: string; requests: number; tokens: number; latency: number; error_rate: number }[];
}

export async function getOverview(userId: number) {
  const [keys, analytics] = await Promise.all([listApiKeys(userId), getAnalytics(userId)]);
  const totals = analytics.reduce((acc, item) => ({ requests: acc.requests + Number(item.requests), tokens: acc.tokens + Number(item.tokens), latencyTotal: acc.latencyTotal + Number(item.latency) * Number(item.requests), errors: acc.errors + Number(item.error_rate) * Number(item.requests) / 100 }), { requests: 0, tokens: 0, latencyTotal: 0, errors: 0 });
  return { activeKeys: keys.filter(key => key.isActive).length, requests: totals.requests, tokens: totals.tokens, averageLatency: totals.requests ? Math.round(totals.latencyTotal / totals.requests) : 0, errorRate: totals.requests ? Number((100 * totals.errors / totals.requests).toFixed(1)) : 0, series: analytics };
}

export async function listUsers() {
  return getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, isDisabled: users.isDisabled, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
}

export async function setUserDisabled(id: number, isDisabled: boolean) {
  return (await getDb().update(users).set({ isDisabled, updatedAt: new Date() }).where(eq(users.id, id)).returning())[0];
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

export async function syncProviderModels(providerId: number) {
  const provider = (await getDb().select().from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  if (!provider.encryptedApiKey) throw new Error("Configure an upstream provider key before discovery");
  if (provider.slug === "anthropic" || provider.slug === "gemini") return { discovered: 0, mode: "manual" as const };
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${decryptSecret(provider.encryptedApiKey)}` } });
  if (!response.ok) throw new Error(`Provider model discovery failed (${response.status})`);
  const payload = await response.json() as { data?: { id?: string }[] };
  const discovered = (payload.data ?? []).filter(item => Boolean(item.id));
  for (const item of discovered) {
    const upstreamId = item.id!;
    const slug = `kiwi/${provider.slug}-${upstreamId.replace(/[^a-zA-Z0-9._-]/g, "-")}`.slice(0, 120);
    await getDb().insert(models).values({ slug, displayName: upstreamId, providerId: provider.id, upstreamId, contextWindow: 128000, inputPrice: "0", outputPrice: "0", creditCostPer1kTokens: "1", routingConfig: { protocol: "openai", discovered: true }, isEnabled: false }).onConflictDoNothing();
  }
  await getDb().update(providers).set({ isHealthy: true, updatedAt: new Date() }).where(eq(providers.id, provider.id));
  return { discovered: discovered.length, mode: "automatic" as const };
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

export async function takeRateLimit(input: { scope: string; subject: string; maxHits: number; windowMs: number }) {
  const windowStart = new Date(Math.floor(Date.now() / input.windowMs) * input.windowMs);
  const result = await getDb().insert(rateLimitBuckets).values({ scope: input.scope.slice(0, 50), subject: input.subject.slice(0, 320), windowStart, hits: 1, updatedAt: new Date() }).onConflictDoUpdate({ target: [rateLimitBuckets.scope, rateLimitBuckets.subject, rateLimitBuckets.windowStart], set: { hits: sql`${rateLimitBuckets.hits} + 1`, updatedAt: new Date() } }).returning({ hits: rateLimitBuckets.hits });
  const hits = result[0]?.hits ?? input.maxHits + 1;
  return { allowed: hits <= input.maxHits, remaining: Math.max(0, input.maxHits - hits), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + input.windowMs - Date.now()) / 1000)) };
}

export async function recordSecurityEvent(input: { eventType: string; userId?: number; ipAddress?: string; metadata?: Record<string, unknown> }) {
  await getDb().insert(securityEvents).values({ userId: input.userId, eventType: input.eventType.slice(0, 80), ipAddress: input.ipAddress, metadata: input.metadata ?? {} });
}
