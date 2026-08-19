import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { apiKeys, models, providers, rateLimitSettings, requestLogs, sessions, usageDaily, users, type User } from "../drizzle/schema";
import { hashApiKey } from "./auth";

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
  return (await getDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1))[0];
}

export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  const existing = await getDb().execute(sql`SELECT COUNT(*)::int AS count FROM users`);
  const count = Number((existing as unknown as { count?: number }[])[0]?.count ?? 0);
  return (await getDb().insert(users).values({ ...input, email: input.email.toLowerCase(), role: count === 0 ? "admin" : "user" }).returning())[0]!;
}

export async function createSession(userId: number, expiresAt: Date) {
  return (await getDb().insert(sessions).values({ id: randomUUID(), userId, expiresAt }).returning())[0]!;
}

export async function deleteSession(id: string) {
  await getDb().delete(sessions).where(eq(sessions.id, id));
}

export async function getSessionWithUser(sessionId: string, userId: number) {
  const record = await getDb().select({
    sessionId: sessions.id, expiresAt: sessions.expiresAt, id: users.id, name: users.name, email: users.email,
    passwordHash: users.passwordHash, role: users.role, isDisabled: users.isDisabled, createdAt: users.createdAt, updatedAt: users.updatedAt,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
  return record[0] as (User & { sessionId: string; expiresAt: Date }) | undefined;
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

export async function updateModel(id: number, input: { isEnabled?: boolean; displayName?: string; upstreamId?: string }) {
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

export async function logRequest(input: { userId: number; apiKeyId: string; modelSlug: string; status: "success" | "error"; inputTokens: number; outputTokens: number; latencyMs: number; errorCode?: string; createdAt?: Date }) {
  const db = getDb();
  const createdAt = input.createdAt ?? new Date();
  const { createdAt: _ignored, ...logValues } = input;
  await db.insert(requestLogs).values({ ...logValues, createdAt });
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

export async function checkRateLimit(userId: number) {
  const setting = (await getDb().select().from(rateLimitSettings).limit(1))[0] ?? { requestsPerMinute: 20, tokensPerMinute: 10000 };
  const since = new Date(Date.now() - 60_000);
  const result = await getDb().execute(sql`SELECT COUNT(*)::int AS requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int AS tokens FROM request_logs WHERE user_id = ${userId} AND created_at >= ${since}`);
  const row = (result as unknown as { requests?: number; tokens?: number }[])[0] ?? {};
  return { allowed: Number(row.requests ?? 0) < setting.requestsPerMinute && Number(row.tokens ?? 0) < setting.tokensPerMinute, limit: setting };
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
