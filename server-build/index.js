// server/_core/index.ts
import { createServer } from "http";
import net from "net";

// server/app.ts
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express2 from "express";

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z } from "zod";

// server/crypto.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function encryptionKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY must be configured");
  return createHash("sha256").update(secret).digest();
}
function encryptSecret(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((value) => value.toString("base64url")).join(".");
}
function decryptSecret(payload) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored provider credential is malformed");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

// server/db.ts
import { randomBytes as randomBytes3, randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// drizzle/schema.ts
import { bigserial, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
var userRole = pgEnum("user_role", ["user", "admin", "founder"]);
var requestStatus = pgEnum("request_status", ["success", "error"]);
var creditEntryType = pgEnum("credit_entry_type", ["grant", "airdrop", "purchase", "spend", "expiry"]);
var creditBucket = pgEnum("credit_bucket", ["stipend", "purchased"]);
var banScope = pgEnum("ban_scope", ["user", "ip", "email_domain"]);
var authTokenPurpose = pgEnum("auth_token_purpose", ["email_verify", "password_reset"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("user"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  stipendCredits: numeric("stipend_credits", { precision: 14, scale: 3 }).notNull().default("0"),
  purchasedCredits: numeric("purchased_credits", { precision: 14, scale: 3 }).notNull().default("0"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);
var sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("sessions_user_idx").on(table.userId)]);
var apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 24 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  lastFour: varchar("last_four", { length: 4 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("api_keys_hash_idx").on(table.keyHash), index("api_keys_user_idx").on(table.userId)]);
var providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  baseUrl: text("base_url").notNull(),
  encryptedApiKey: text("encrypted_api_key"),
  isHealthy: boolean("is_healthy").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("providers_slug_idx").on(table.slug)]);
var models = pgTable("models", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  upstreamId: varchar("upstream_id", { length: 160 }).notNull(),
  contextWindow: integer("context_window").notNull().default(128e3),
  inputPrice: numeric("input_price", { precision: 12, scale: 6 }).notNull().default("0"),
  outputPrice: numeric("output_price", { precision: 12, scale: 6 }).notNull().default("0"),
  creditCostPer1kTokens: numeric("credit_cost_per_1k_tokens", { precision: 12, scale: 3 }).notNull().default("1"),
  routingConfig: jsonb("routing_config").notNull().default({ protocol: "openai" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("models_slug_idx").on(table.slug), index("models_provider_idx").on(table.providerId)]);
var requestLogs = pgTable("request_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  modelSlug: varchar("model_slug", { length: 120 }).notNull(),
  status: requestStatus("status").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  errorCode: varchar("error_code", { length: 80 }),
  creditsDeducted: numeric("credits_deducted", { precision: 14, scale: 3 }).notNull().default("0"),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgentHash: varchar("user_agent_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("request_logs_user_created_idx").on(table.userId, table.createdAt), index("request_logs_key_created_idx").on(table.apiKeyId, table.createdAt)]);
var usageDaily = pgTable("usage_daily", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  requests: integer("requests").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  totalLatencyMs: integer("total_latency_ms").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("usage_daily_user_day_idx").on(table.userId, table.day)]);
var rateLimitSettings = pgTable("rate_limit_settings", {
  id: serial("id").primaryKey(),
  requestsPerMinute: integer("requests_per_minute").notNull().default(30),
  tokensPerMinute: integer("tokens_per_minute").notNull().default(1e4),
  ipRequestsPerMinute: integer("ip_requests_per_minute").notNull().default(60),
  globalApiEnabled: boolean("global_api_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var creditLedger = pgTable("credit_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 3 }).notNull(),
  entryType: creditEntryType("entry_type").notNull(),
  bucket: creditBucket("bucket").notNull(),
  description: text("description").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("credit_ledger_user_created_idx").on(table.userId, table.createdAt), index("credit_ledger_expiry_idx").on(table.expiresAt)]);
var announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("notice"),
  creditsPerUser: numeric("credits_per_user", { precision: 14, scale: 3 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var loginRecords = pgTable("login_records", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgentHash: varchar("user_agent_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("login_records_user_created_idx").on(table.userId, table.createdAt)]);
var accessBans = pgTable("access_bans", {
  id: serial("id").primaryKey(),
  scope: banScope("scope").notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  reason: text("reason").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("access_bans_scope_value_idx").on(table.scope, table.value)]);
var authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  purpose: authTokenPurpose("purpose").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  requestIp: varchar("request_ip", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("auth_tokens_hash_idx").on(table.tokenHash), index("auth_tokens_email_purpose_idx").on(table.email, table.purpose)]);
var rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 320 }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  hits: integer("hits").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("rate_limit_buckets_scope_subject_window_idx").on(table.scope, table.subject, table.windowStart), index("rate_limit_buckets_expiry_idx").on(table.windowStart)]);
var securityEvents = pgTable("security_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("security_events_user_created_idx").on(table.userId, table.createdAt), index("security_events_type_created_idx").on(table.eventType, table.createdAt)]);

// server/auth.ts
import { createHash as createHash2, randomBytes as randomBytes2, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var scrypt = promisify(scryptCallback);
var SESSION_COOKIE = "kiwi_session";
var SESSION_DURATION_MS = 1e3 * 60 * 60 * 24 * 7;
function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured");
  return new TextEncoder().encode(secret);
}
async function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password, storedHash) {
  const [salt, storedValue] = storedHash.split(":");
  if (!salt || !storedValue) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(storedValue, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDisabled: user.isDisabled,
    emailVerified: Boolean(user.emailVerifiedAt),
    stipendCredits: Number(user.stipendCredits),
    purchasedCredits: Number(user.purchasedCredits),
    kiwiCredits: Number(user.stipendCredits) + Number(user.purchasedCredits),
    createdAt: user.createdAt
  };
}
async function startSession(res, user) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await createSession(user.id, expiresAt);
  const token = await new SignJWT({ sid: session.id, role: user.role }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime(Math.floor(expiresAt.getTime() / 1e3)).sign(signingKey());
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS
  });
}
async function endSession(req, res) {
  const token = parse(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (token) {
    try {
      const { payload } = await jwtVerify(token, signingKey());
      if (typeof payload.sid === "string") await deleteSession(payload.sid);
    } catch {
    }
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}
async function getSessionUser(req) {
  const token = parse(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    const sessionRecord = await getSessionWithUser(payload.sid, Number(payload.sub));
    if (!sessionRecord || sessionRecord.expiresAt < /* @__PURE__ */ new Date() || sessionRecord.isDisabled || !sessionRecord.emailVerifiedAt) return null;
    return sessionRecord;
  } catch {
    return null;
  }
}
function hashApiKey(value) {
  return createHash2("sha256").update(value).digest("hex");
}

// server/founder.ts
var FOUNDER_EMAIL = "indiasikhotechno@gmail.com";
function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at).split("+")[0] ?? "";
  return `${local}${email.slice(at)}`;
}
function isFounderEmail(email) {
  return normalizeEmail(email) === FOUNDER_EMAIL;
}
function getRequestIp(headers) {
  const forwarded = headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || void 0;
}

// server/db.ts
var database;
function getDb() {
  if (!database) {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL must be configured");
    database = drizzle(neon(connectionString));
  }
  return database;
}
async function getUserByEmail(email) {
  return (await getDb().select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1))[0];
}
async function getUserById(id) {
  return (await getDb().select().from(users).where(eq(users.id, id)).limit(1))[0];
}
async function createUser(input) {
  const email = normalizeEmail(input.email);
  return (await getDb().insert(users).values({ ...input, email, role: isFounderEmail(email) ? "founder" : "user" }).returning())[0];
}
async function promoteFounderRecord() {
  return (await getDb().update(users).set({ role: "founder", isDisabled: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.email, "indiasikhotechno@gmail.com")).returning())[0];
}
async function createSession(userId, expiresAt) {
  return (await getDb().insert(sessions).values({ id: randomUUID(), userId, expiresAt }).returning())[0];
}
async function deleteSession(id) {
  await getDb().delete(sessions).where(eq(sessions.id, id));
}
async function deleteAllUserSessions(userId) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}
async function getSessionWithUser(sessionId, userId) {
  const record = await getDb().select({
    sessionId: sessions.id,
    expiresAt: sessions.expiresAt,
    id: users.id,
    name: users.name,
    email: users.email,
    passwordHash: users.passwordHash,
    role: users.role,
    isDisabled: users.isDisabled,
    emailVerifiedAt: users.emailVerifiedAt,
    emailVerificationSentAt: users.emailVerificationSentAt,
    failedLoginCount: users.failedLoginCount,
    lockedUntil: users.lockedUntil,
    stipendCredits: users.stipendCredits,
    purchasedCredits: users.purchasedCredits,
    stripeCustomerId: users.stripeCustomerId,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
  return record[0];
}
async function markEmailVerified(userId) {
  return (await getDb().update(users).set({ emailVerifiedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)).returning())[0];
}
async function updatePasswordAndRevokeSessions(userId, passwordHash) {
  const user = (await getDb().update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)).returning())[0];
  await deleteAllUserSessions(userId);
  return user;
}
async function recordFailedLogin(userId) {
  const user = await getUserById(userId);
  if (!user) return;
  const next = user.failedLoginCount + 1;
  await getDb().update(users).set({ failedLoginCount: next, lockedUntil: next >= 5 ? new Date(Date.now() + 15 * 6e4) : user.lockedUntil, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function clearLoginFailures(userId) {
  await getDb().update(users).set({ failedLoginCount: 0, lockedUntil: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function createApiKey(userId, name) {
  const plainKey = `kiwi_sk_${randomBytes3(24).toString("base64url")}`;
  const saved = (await getDb().insert(apiKeys).values({ userId, name, keyPrefix: plainKey.slice(0, 16), keyHash: hashApiKey(plainKey), lastFour: plainKey.slice(-4) }).returning())[0];
  return { ...saved, plainKey };
}
async function listApiKeys(userId) {
  return getDb().select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastFour: apiKeys.lastFour, isActive: apiKeys.isActive, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}
async function revokeApiKey(userId, id) {
  const result = await getDb().update(apiKeys).set({ isActive: false, revokedAt: /* @__PURE__ */ new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).returning({ id: apiKeys.id });
  return Boolean(result[0]);
}
async function getApiKeyOwner(plainKey) {
  const result = await getDb().select({ apiKey: apiKeys, user: users }).from(apiKeys).innerJoin(users, eq(apiKeys.userId, users.id)).where(and(eq(apiKeys.keyHash, hashApiKey(plainKey)), eq(apiKeys.isActive, true), eq(users.isDisabled, false))).limit(1);
  if (!result[0]) return void 0;
  await getDb().update(apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(apiKeys.id, result[0].apiKey.id));
  return result[0];
}
async function listModels(enabledOnly = true) {
  const query = getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id));
  return enabledOnly ? query.where(and(eq(models.isEnabled, true), eq(providers.isEnabled, true))).orderBy(models.slug) : query.orderBy(models.slug);
}
async function getGatewayRoute(slug) {
  return (await getDb().select({ model: models, provider: providers }).from(models).innerJoin(providers, eq(models.providerId, providers.id)).where(and(eq(models.slug, slug), eq(models.isEnabled, true), eq(providers.isEnabled, true))).limit(1))[0];
}
async function createModel(input) {
  return (await getDb().insert(models).values({ ...input, routingConfig: { protocol: "openai" } }).returning())[0];
}
async function updateModel(id, input) {
  return (await getDb().update(models).set({ ...input, updatedAt: /* @__PURE__ */ new Date() }).where(eq(models.id, id)).returning())[0];
}
async function listProviders() {
  return getDb().select({ id: providers.id, slug: providers.slug, displayName: providers.displayName, baseUrl: providers.baseUrl, isHealthy: providers.isHealthy, isEnabled: providers.isEnabled, isConfigured: sql`${providers.encryptedApiKey} IS NOT NULL` }).from(providers).orderBy(providers.displayName);
}
async function saveProvider(input) {
  const existing = (await getDb().select().from(providers).where(eq(providers.slug, input.slug)).limit(1))[0];
  const values = { ...input, updatedAt: /* @__PURE__ */ new Date() };
  if (existing) return (await getDb().update(providers).set(values).where(eq(providers.id, existing.id)).returning())[0];
  return (await getDb().insert(providers).values({ ...values, isHealthy: Boolean(input.encryptedApiKey) }).returning())[0];
}
async function logRequest(input) {
  const db = getDb();
  const createdAt = input.createdAt ?? /* @__PURE__ */ new Date();
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
    updatedAt: createdAt
  }).onConflictDoUpdate({
    target: [usageDaily.userId, usageDaily.day],
    set: {
      requests: sql`${usageDaily.requests} + 1`,
      inputTokens: sql`${usageDaily.inputTokens} + ${input.inputTokens}`,
      outputTokens: sql`${usageDaily.outputTokens} + ${input.outputTokens}`,
      errorCount: sql`${usageDaily.errorCount} + ${input.status === "error" ? 1 : 0}`,
      totalLatencyMs: sql`${usageDaily.totalLatencyMs} + ${input.latencyMs}`,
      updatedAt: createdAt
    }
  });
}
async function checkRateLimit(userId, ipAddress) {
  const setting = (await getDb().select().from(rateLimitSettings).limit(1))[0] ?? { requestsPerMinute: 30, tokensPerMinute: 1e4, ipRequestsPerMinute: 60, globalApiEnabled: true };
  if (!setting.globalApiEnabled) return { allowed: false, limit: setting, reason: "api_disabled" };
  const since = new Date(Date.now() - 6e4);
  const result = await getDb().execute(sql`SELECT COUNT(*)::int AS requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int AS tokens FROM request_logs WHERE user_id = ${userId} AND created_at >= ${since}`);
  const row = result[0] ?? {};
  const ipResult = ipAddress ? await getDb().execute(sql`SELECT COUNT(*)::int AS requests FROM request_logs WHERE ip_address = ${ipAddress} AND created_at >= ${since}`) : [];
  const ipRequests = Number(ipResult[0]?.requests ?? 0);
  return { allowed: Number(row.requests ?? 0) < setting.requestsPerMinute && Number(row.tokens ?? 0) < setting.tokensPerMinute && ipRequests < setting.ipRequestsPerMinute, limit: setting, reason: "rate_limit" };
}
async function isAccessBanned(userId, email, ipAddress) {
  const domain = email.split("@")[1] ?? "";
  const clauses = [and(eq(accessBans.scope, "user"), eq(accessBans.value, String(userId))), and(eq(accessBans.scope, "email_domain"), eq(accessBans.value, domain))];
  if (ipAddress) clauses.push(and(eq(accessBans.scope, "ip"), eq(accessBans.value, ipAddress)));
  const ban = (await getDb().select({ id: accessBans.id }).from(accessBans).where(and(eq(accessBans.isActive, true), or(...clauses))).limit(1))[0];
  return Boolean(ban);
}
async function getAnalytics(userId) {
  const since = new Date(Date.now() - 1e3 * 60 * 60 * 24 * 14);
  return await getDb().execute(sql`SELECT TO_CHAR(day, 'Mon DD') AS day, requests, (input_tokens + output_tokens)::int AS tokens, CASE WHEN requests > 0 THEN ROUND(total_latency_ms::numeric / requests)::int ELSE 0 END AS latency, CASE WHEN requests > 0 THEN ROUND(100.0 * error_count / requests, 1) ELSE 0 END AS error_rate FROM usage_daily WHERE user_id = ${userId} AND day >= ${since.toISOString().slice(0, 10)}::date ORDER BY day`);
}
async function getOverview(userId) {
  const [keys, analytics] = await Promise.all([listApiKeys(userId), getAnalytics(userId)]);
  const totals = analytics.reduce((acc, item) => ({ requests: acc.requests + Number(item.requests), tokens: acc.tokens + Number(item.tokens), latencyTotal: acc.latencyTotal + Number(item.latency) * Number(item.requests), errors: acc.errors + Number(item.error_rate) * Number(item.requests) / 100 }), { requests: 0, tokens: 0, latencyTotal: 0, errors: 0 });
  return { activeKeys: keys.filter((key) => key.isActive).length, requests: totals.requests, tokens: totals.tokens, averageLatency: totals.requests ? Math.round(totals.latencyTotal / totals.requests) : 0, errorRate: totals.requests ? Number((100 * totals.errors / totals.requests).toFixed(1)) : 0, series: analytics };
}
async function listUsers() {
  return getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, isDisabled: users.isDisabled, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
}
async function setUserDisabled(id, isDisabled) {
  return (await getDb().update(users).set({ isDisabled, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning())[0];
}
async function getRateLimitSettings() {
  return (await getDb().select().from(rateLimitSettings).limit(1))[0] ?? { id: 0, requestsPerMinute: 20, tokensPerMinute: 1e4, updatedAt: /* @__PURE__ */ new Date() };
}
async function saveRateLimits(input) {
  const existing = (await getDb().select().from(rateLimitSettings).limit(1))[0];
  if (existing) return (await getDb().update(rateLimitSettings).set({ ...input, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rateLimitSettings.id, existing.id)).returning())[0];
  return (await getDb().insert(rateLimitSettings).values(input).returning())[0];
}
async function seedDemoData(adminId) {
  const db = getDb();
  const providerSeeds = [{ slug: "openai", displayName: "OpenAI", baseUrl: "https://api.openai.com/v1" }, { slug: "groq", displayName: "Groq", baseUrl: "https://api.groq.com/openai/v1" }, { slug: "anthropic", displayName: "Anthropic", baseUrl: "https://api.anthropic.com/v1" }];
  for (const provider of providerSeeds) await db.insert(providers).values({ ...provider, isEnabled: true }).onConflictDoNothing();
  const providerRows = await db.select().from(providers);
  const idBySlug = new Map(providerRows.map((provider) => [provider.slug, provider.id]));
  const modelSeeds = [{ slug: "kiwi/gpt-4o-mini", displayName: "GPT-4o mini", provider: "openai", upstreamId: "gpt-4o-mini", contextWindow: 128e3, inputPrice: "0.15", outputPrice: "0.60" }, { slug: "kiwi/llama-3.3-70b", displayName: "Llama 3.3 70B", provider: "groq", upstreamId: "llama-3.3-70b-versatile", contextWindow: 128e3, inputPrice: "0.59", outputPrice: "0.79" }, { slug: "kiwi/claude-sonnet", displayName: "Claude Sonnet", provider: "anthropic", upstreamId: "claude-3-5-sonnet-latest", contextWindow: 2e5, inputPrice: "3.00", outputPrice: "15.00" }];
  for (const model of modelSeeds) {
    const providerId = idBySlug.get(model.provider);
    if (providerId) await db.insert(models).values({ ...model, providerId, routingConfig: { protocol: "openai" } }).onConflictDoNothing();
  }
  await saveRateLimits({ requestsPerMinute: 20, tokensPerMinute: 1e4 });
  const existing = await db.execute(sql`SELECT COUNT(*)::int AS count FROM request_logs WHERE user_id = ${adminId}`);
  if (Number(existing[0]?.count ?? 0) === 0) {
    const seedKey = await createApiKey(adminId, "Seed telemetry");
    for (let day = 13; day >= 0; day -= 1) await logRequest({ userId: adminId, apiKeyId: seedKey.id, modelSlug: day % 2 ? "kiwi/gpt-4o-mini" : "kiwi/llama-3.3-70b", status: day === 5 ? "error" : "success", inputTokens: 420 + day * 37, outputTokens: 160 + day * 12, latencyMs: 380 + day * 14, errorCode: day === 5 ? "upstream_timeout" : void 0, createdAt: new Date(Date.now() - day * 864e5) });
  }
}
async function getCreditEconomy() {
  const totals = await getDb().execute(sql`SELECT COALESCE(SUM(stipend_credits + purchased_credits), 0)::numeric AS circulating, COUNT(*)::int AS users FROM users WHERE is_disabled = false`);
  const burn = await getDb().execute(sql`SELECT COALESCE(SUM(-amount), 0)::numeric AS daily_burn FROM credit_ledger WHERE entry_type = 'spend' AND created_at >= NOW() - INTERVAL '24 hours'`);
  const spenders = await getDb().execute(sql`SELECT u.id, u.name, u.email, COALESCE(SUM(-l.amount), 0)::numeric AS spent FROM users u LEFT JOIN credit_ledger l ON l.user_id = u.id AND l.entry_type = 'spend' AND l.created_at >= NOW() - INTERVAL '24 hours' GROUP BY u.id ORDER BY spent DESC LIMIT 8`);
  return { circulating: Number(totals[0]?.circulating ?? 0), users: Number(totals[0]?.users ?? 0), dailyBurn: Number(burn[0]?.daily_burn ?? 0), topSpenders: spenders };
}
async function listAnnouncements(activeOnly = true) {
  const query = getDb().select().from(announcements);
  return activeOnly ? query.where(eq(announcements.isActive, true)).orderBy(desc(announcements.createdAt)) : query.orderBy(desc(announcements.createdAt));
}
async function createAnnouncement(input) {
  const announcement = (await getDb().insert(announcements).values({ message: input.message, kind: input.kind, creditsPerUser: input.creditsPerUser.toFixed(3), createdBy: input.createdBy }).returning())[0];
  return announcement;
}
async function setAnnouncementActive(id, isActive) {
  return (await getDb().update(announcements).set({ isActive }).where(eq(announcements.id, id)).returning())[0];
}
async function getUserForensics(userId) {
  const user = (await getDb().select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return null;
  const [ledger, logs, logins, keys] = await Promise.all([
    getDb().select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(1e3),
    getDb().select().from(requestLogs).where(eq(requestLogs.userId, userId)).orderBy(desc(requestLogs.createdAt)).limit(1e3),
    getDb().select().from(loginRecords).where(eq(loginRecords.userId, userId)).orderBy(desc(loginRecords.createdAt)).limit(100),
    listApiKeys(userId)
  ]);
  return { user, ledger, logs, logins, keys };
}
async function recordLogin(userId, ipAddress, userAgentHash) {
  await getDb().insert(loginRecords).values({ userId, ipAddress, userAgentHash });
}
async function setGlobalApiEnabled(globalApiEnabled) {
  const existing = (await getDb().select().from(rateLimitSettings).limit(1))[0];
  if (existing) return (await getDb().update(rateLimitSettings).set({ globalApiEnabled, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rateLimitSettings.id, existing.id)).returning())[0];
  return (await getDb().insert(rateLimitSettings).values({ globalApiEnabled }).returning())[0];
}
async function setStripeCustomerId(userId, stripeCustomerId) {
  await getDb().update(users).set({ stripeCustomerId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function syncProviderModels(providerId) {
  const provider = (await getDb().select().from(providers).where(eq(providers.id, providerId)).limit(1))[0];
  if (!provider) throw new Error("Provider not found");
  if (!provider.encryptedApiKey) throw new Error("Configure an upstream provider key before discovery");
  if (provider.slug === "anthropic" || provider.slug === "gemini") return { discovered: 0, mode: "manual" };
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${decryptSecret(provider.encryptedApiKey)}` } });
  if (!response.ok) throw new Error(`Provider model discovery failed (${response.status})`);
  const payload = await response.json();
  const discovered = (payload.data ?? []).filter((item) => Boolean(item.id));
  for (const item of discovered) {
    const upstreamId = item.id;
    const slug = `kiwi/${provider.slug}-${upstreamId.replace(/[^a-zA-Z0-9._-]/g, "-")}`.slice(0, 120);
    await getDb().insert(models).values({ slug, displayName: upstreamId, providerId: provider.id, upstreamId, contextWindow: 128e3, inputPrice: "0", outputPrice: "0", creditCostPer1kTokens: "1", routingConfig: { protocol: "openai", discovered: true }, isEnabled: false }).onConflictDoNothing();
  }
  await getDb().update(providers).set({ isHealthy: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(providers.id, provider.id));
  return { discovered: discovered.length, mode: "automatic" };
}
async function banUserAccess(userId, founderId, reason) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("User not found");
  if (isFounderEmail(user.email) || user.role === "founder") throw new Error("The founder account is immutable");
  await db.update(users).set({ isDisabled: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  await db.update(apiKeys).set({ isActive: false, revokedAt: /* @__PURE__ */ new Date() }).where(eq(apiKeys.userId, userId));
  const domain = user.email.split("@")[1] ?? "";
  await db.insert(accessBans).values({ scope: "user", value: String(userId), reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  if (domain) await db.insert(accessBans).values({ scope: "email_domain", value: domain, reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  const lastIp = (await db.select({ ipAddress: loginRecords.ipAddress }).from(loginRecords).where(and(eq(loginRecords.userId, userId), isNotNull(loginRecords.ipAddress))).orderBy(desc(loginRecords.createdAt)).limit(1))[0]?.ipAddress;
  if (lastIp) await db.insert(accessBans).values({ scope: "ip", value: lastIp, reason, createdBy: founderId }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason, createdBy: founderId } });
  return user;
}
async function banIpAddress(ipAddress, reason) {
  if (!ipAddress) return;
  await getDb().insert(accessBans).values({ scope: "ip", value: ipAddress, reason }).onConflictDoUpdate({ target: [accessBans.scope, accessBans.value], set: { isActive: true, reason } });
}
async function createAuthToken(input) {
  const rawToken = randomBytes3(32).toString("base64url");
  const email = normalizeEmail(input.email);
  const tokenHash = hashApiKey(rawToken);
  await getDb().update(authTokens).set({ consumedAt: /* @__PURE__ */ new Date() }).where(and(eq(authTokens.email, email), eq(authTokens.purpose, input.purpose), isNull(authTokens.consumedAt)));
  await getDb().insert(authTokens).values({ userId: input.userId, email, purpose: input.purpose, tokenHash, requestIp: input.requestIp, expiresAt: new Date(Date.now() + input.expiresInMs) });
  return rawToken;
}
async function consumeAuthToken(input) {
  const now = /* @__PURE__ */ new Date();
  return (await getDb().update(authTokens).set({ consumedAt: now }).where(and(eq(authTokens.tokenHash, hashApiKey(input.rawToken)), eq(authTokens.purpose, input.purpose), isNull(authTokens.consumedAt), gte(authTokens.expiresAt, now))).returning())[0];
}
async function takeRateLimit(input) {
  const windowStart = new Date(Math.floor(Date.now() / input.windowMs) * input.windowMs);
  const result = await getDb().insert(rateLimitBuckets).values({ scope: input.scope.slice(0, 50), subject: input.subject.slice(0, 320), windowStart, hits: 1, updatedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: [rateLimitBuckets.scope, rateLimitBuckets.subject, rateLimitBuckets.windowStart], set: { hits: sql`${rateLimitBuckets.hits} + 1`, updatedAt: /* @__PURE__ */ new Date() } }).returning({ hits: rateLimitBuckets.hits });
  const hits = result[0]?.hits ?? input.maxHits + 1;
  return { allowed: hits <= input.maxHits, remaining: Math.max(0, input.maxHits - hits), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + input.windowMs - Date.now()) / 1e3)) };
}
async function recordSecurityEvent(input) {
  await getDb().insert(securityEvents).values({ userId: input.userId, eventType: input.eventType.slice(0, 80), ipAddress: input.ipAddress, metadata: input.metadata ?? {} });
}

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";

// server/security.ts
import { TRPCError } from "@trpc/server";
async function enforceRateLimit(input) {
  const result = await takeRateLimit(input);
  if (result.allowed) return result;
  await recordSecurityEvent({ eventType: "rate_limit_blocked", userId: input.userId, ipAddress: input.ipAddress, metadata: { scope: input.scope } });
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please wait and try again.", cause: { retryAfterSeconds: result.retryAfterSeconds } });
}
async function enforceAuthRateLimits(input) {
  const windowMs = 15 * 6e4;
  await enforceRateLimit({ scope: `auth:${input.action}:ip`, subject: input.ipAddress || "unknown", maxHits: input.action === "login" ? 12 : 8, windowMs, ipAddress: input.ipAddress });
  await enforceRateLimit({ scope: `auth:${input.action}:email`, subject: input.email.toLowerCase(), maxHits: input.action === "login" ? 8 : 5, windowMs, ipAddress: input.ipAddress });
}
function assertSafeUpstreamUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const privateIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  if (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local") || privateIpv4.test(hostname) || hostname === "::1") throw new Error("Provider URLs must use public HTTPS endpoints");
  return url;
}

// server/_core/trpc.ts
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var accountRateLimit = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const ipAddress = getRequestIp(ctx.req.headers);
  await enforceRateLimit({ scope: "trpc:account", subject: String(ctx.user.id), maxHits: 120, windowMs: 6e4, userId: ctx.user.id, ipAddress });
  await enforceRateLimit({ scope: "trpc:account-ip", subject: `${ctx.user.id}:${ipAddress || "unknown"}`, maxHits: 90, windowMs: 6e4, userId: ctx.user.id, ipAddress });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var protectedProcedure = t.procedure.use(requireUser).use(accountRateLimit);
var requireFounder = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user || ctx.user.email !== FOUNDER_EMAIL || ctx.user.role !== "founder") throw new TRPCError2({ code: "FORBIDDEN", message: "Founder access is required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var adminProcedure = t.procedure.use(requireFounder).use(accountRateLimit);

// server/credits.ts
import { and as and2, desc as desc2, eq as eq2, isNull as isNull2, lt as lt2, sql as sql2 } from "drizzle-orm";
var number = (value) => Number(value ?? 0);
function balanceOf(user) {
  return number(user.stipendCredits) + number(user.purchasedCredits);
}
function creditsForTokens(creditCostPer1kTokens, inputTokens, outputTokens) {
  return Math.ceil((Math.max(0, inputTokens) + Math.max(0, outputTokens)) / 1e3 * Math.max(0, creditCostPer1kTokens));
}
async function creditSummary(userId) {
  const user = (await getDb().select({ stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits }).from(users).where(eq2(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("User not found");
  return { stipend: number(user.stipendCredits), purchased: number(user.purchasedCredits), total: balanceOf(user) };
}
async function addCredits(input) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Credit amount must be positive");
  const db = getDb();
  if (input.stripePaymentIntentId) {
    const alreadyFulfilled = (await db.select({ id: creditLedger.id }).from(creditLedger).where(eq2(creditLedger.stripePaymentIntentId, input.stripePaymentIntentId)).limit(1))[0];
    if (alreadyFulfilled) return creditSummary(input.userId);
  }
  const column = input.bucket === "stipend" ? users.stipendCredits : users.purchasedCredits;
  await db.update(users).set({ [input.bucket === "stipend" ? "stipendCredits" : "purchasedCredits"]: sql2`${column} + ${input.amount}`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, input.userId));
  await db.insert(creditLedger).values({ ...input, amount: input.amount.toFixed(3) });
  return creditSummary(input.userId);
}
async function quoteCredits(modelSlug, inputTokens, outputTokens) {
  const model = (await getDb().select({ creditCost: models.creditCostPer1kTokens }).from(models).where(eq2(models.slug, modelSlug)).limit(1))[0];
  if (!model) return 0;
  return creditsForTokens(number(model.creditCost), inputTokens, outputTokens);
}
async function canSpendCredits(user, modelSlug, reserveTokens) {
  if (user.role === "founder") return { allowed: true, required: 0, balance: balanceOf(user) };
  const required = await quoteCredits(modelSlug, reserveTokens, 0);
  return { allowed: balanceOf(user) >= required, required, balance: balanceOf(user) };
}
async function spendCredits(userId, modelSlug, inputTokens, outputTokens, description) {
  const db = getDb();
  const user = (await db.select({ role: users.role, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits }).from(users).where(eq2(users.id, userId)).limit(1))[0];
  if (!user || user.role === "founder") return 0;
  const amount = await quoteCredits(modelSlug, inputTokens, outputTokens);
  if (amount <= 0) return 0;
  let remaining = amount;
  const stipendUsed = Math.min(number(user.stipendCredits), remaining);
  if (stipendUsed) {
    await db.update(users).set({ stipendCredits: sql2`GREATEST(${users.stipendCredits} - ${stipendUsed}, 0)`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, userId));
    await db.insert(creditLedger).values({ userId, amount: (-stipendUsed).toFixed(3), entryType: "spend", bucket: "stipend", description });
    remaining -= stipendUsed;
  }
  if (remaining > 0) {
    await db.update(users).set({ purchasedCredits: sql2`GREATEST(${users.purchasedCredits} - ${remaining}, 0)`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, userId));
    await db.insert(creditLedger).values({ userId, amount: (-remaining).toFixed(3), entryType: "spend", bucket: "purchased", description });
  }
  return amount;
}
async function dailyCreditMaintenance(now = /* @__PURE__ */ new Date()) {
  const db = getDb();
  const expiredStipends = await db.select({ id: creditLedger.id, userId: creditLedger.userId, amount: creditLedger.amount }).from(creditLedger).where(and2(eq2(creditLedger.bucket, "stipend"), isNull2(creditLedger.expiredAt), lt2(creditLedger.expiresAt, now)));
  let expired = 0;
  for (const stipend of expiredStipends) {
    const amount = number(stipend.amount);
    if (amount > 0) {
      await db.update(users).set({ stipendCredits: sql2`GREATEST(${users.stipendCredits} - ${amount}, 0)`, updatedAt: now }).where(eq2(users.id, stipend.userId));
      await db.update(creditLedger).set({ expiredAt: now }).where(eq2(creditLedger.id, stipend.id));
      await db.insert(creditLedger).values({ userId: stipend.userId, amount: (-amount).toFixed(3), entryType: "expiry", bucket: "stipend", description: "Expired daily Kiwi Credit stipend", expiredAt: now });
      expired += 1;
    }
  }
  const recipients = await db.select({ id: users.id, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits, role: users.role }).from(users);
  let granted = 0;
  for (const user of recipients) {
    if (user.role === "founder" || balanceOf(user) >= 100) continue;
    const description = `Daily Kiwi Credit stipend ${now.toISOString().slice(0, 10)}`;
    const alreadyGranted = (await db.select({ id: creditLedger.id }).from(creditLedger).where(and2(eq2(creditLedger.userId, user.id), eq2(creditLedger.description, description))).limit(1))[0];
    if (alreadyGranted) continue;
    await addCredits({ userId: user.id, amount: 50, bucket: "stipend", entryType: "grant", description, expiresAt: new Date(now.getTime() + 864e5) });
    granted += 1;
  }
  return { expired, granted };
}

// server/creditPacks.ts
var CREDIT_PACKS = {
  sprout: { label: "Sprout", credits: 500, unitAmount: 500 },
  grove: { label: "Grove", credits: 2500, unitAmount: 2e3 },
  orchard: { label: "Orchard", credits: 7500, unitAmount: 5e3 }
};
function getCreditPack(id) {
  const pack = CREDIT_PACKS[id];
  if (!pack) throw new Error("Unknown Kiwi Credit pack");
  return pack;
}

// server/stripeCredits.ts
import Stripe from "stripe";
function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
async function createCreditCheckout(input) {
  const pack = getCreditPack(input.packId);
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: String(input.userId),
    metadata: { user_id: String(input.userId), customer_email: input.email, customer_name: input.name, kiwi_credits: String(pack.credits), pack_id: input.packId },
    line_items: [{ price_data: { currency: "usd", product_data: { name: `${pack.label} Kiwi Credits`, description: `${pack.credits.toLocaleString()} non-expiring Kiwi Credits` }, unit_amount: pack.unitAmount }, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${input.origin}/?checkout=success`,
    cancel_url: `${input.origin}/?checkout=cancelled`
  });
  if (!session.url) throw new Error("Stripe Checkout did not return a URL");
  return { url: session.url };
}
function registerStripeWebhook(app) {
  app.post("/api/stripe/webhook", async (req, res) => {
    const signature = req.header("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).json({ error: "Missing Stripe signature configuration" });
    let event;
    try {
      event = stripeClient().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
    if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
      const credits = Number(session.metadata?.kiwi_credits ?? 0);
      if (userId && credits > 0) {
        await addCredits({ userId, amount: credits, bucket: "purchased", entryType: "purchase", description: `Stripe ${session.metadata?.pack_id ?? "credit"} pack`, stripePaymentIntentId: String(session.payment_intent ?? session.id) });
        if (typeof session.customer === "string") await setStripeCustomerId(userId, session.customer);
      }
    }
    return res.json({ received: true });
  });
}

// server/email.ts
function appOrigin(req) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) throw new Error("APP_URL must be configured for email links");
  return `${req.protocol}://${host}`;
}
async function sendMail(input) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !process.env.RESEND_FROM_EMAIL) {
    console.warn("[Email] Transactional mail is not configured; delivery was skipped.");
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [input.to], subject: input.subject, html: input.html }) });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status})`);
  return true;
}
async function sendVerificationEmail(req, email, token) {
  const url = `${appOrigin(req)}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({ to: email, subject: "Verify your Cloudhug Kiwi Router email", html: `<p>Welcome to Cloudhug's Kiwi Router.</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 30 minutes.</p>` });
}
async function sendPasswordResetEmail(req, email, token) {
  const url = `${appOrigin(req)}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({ to: email, subject: "Reset your Cloudhug Kiwi Router password", html: `<p>A password reset was requested for your account.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 20 minutes. If you did not request it, you can ignore this email.</p>` });
}

// server/routers.ts
var emailSchema = z.string().trim().email().max(320);
var passwordSchema = z.string().min(10, "Use at least 10 characters").max(128);
var appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "register", email: input.email, ipAddress });
      if (await getUserByEmail(input.email)) throw new TRPCError3({ code: "CONFLICT", message: "An account with this email already exists" });
      const user = await createUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
      const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "email_verify", requestIp: ipAddress, expiresInMs: 30 * 6e4 });
      await sendVerificationEmail(ctx.req, user.email, token);
      await recordSecurityEvent({ eventType: "registration_created", userId: user.id, ipAddress });
      return { email: user.email, requiresEmailVerification: true };
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(32).max(256) })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "verify", email: hashApiKey(input.token), ipAddress });
      const token = await consumeAuthToken({ rawToken: input.token, purpose: "email_verify" });
      if (!token?.userId) throw new TRPCError3({ code: "BAD_REQUEST", message: "This verification link is invalid or expired" });
      const user = await markEmailVerified(token.userId);
      if (!user || user.isDisabled) throw new TRPCError3({ code: "FORBIDDEN", message: "Account access is unavailable" });
      await startSession(ctx.res, user);
      await recordLogin(user.id, ipAddress, ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")) : void 0);
      await recordSecurityEvent({ eventType: "email_verified", userId: user.id, ipAddress });
      return toPublicUser(user);
    }),
    resendVerification: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "verify", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      if (user && !user.emailVerifiedAt && !user.isDisabled) {
        const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "email_verify", requestIp: ipAddress, expiresInMs: 30 * 6e4 });
        await sendVerificationEmail(ctx.req, user.email, token);
        await recordSecurityEvent({ eventType: "verification_resent", userId: user.id, ipAddress });
      }
      return { success: true };
    }),
    login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "login", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      const locked = user?.lockedUntil && user.lockedUntil > /* @__PURE__ */ new Date();
      if (!user || locked || !await verifyPassword(input.password, user.passwordHash) || user.isDisabled) {
        if (user) await recordFailedLogin(user.id);
        await recordSecurityEvent({ eventType: "login_failed", userId: user?.id, ipAddress });
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Email or password is incorrect" });
      }
      if (!user.emailVerifiedAt) throw new TRPCError3({ code: "FORBIDDEN", message: "Verify your email address before signing in" });
      await clearLoginFailures(user.id);
      await startSession(ctx.res, user);
      await recordLogin(user.id, ipAddress, ctx.req.header("user-agent") ? hashApiKey(ctx.req.header("user-agent")) : void 0);
      await recordSecurityEvent({ eventType: "login_success", userId: user.id, ipAddress });
      return toPublicUser(user);
    }),
    requestPasswordReset: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "password_reset", email: input.email, ipAddress });
      const user = await getUserByEmail(input.email);
      if (user && user.emailVerifiedAt && !user.isDisabled) {
        const token = await createAuthToken({ userId: user.id, email: user.email, purpose: "password_reset", requestIp: ipAddress, expiresInMs: 20 * 6e4 });
        await sendPasswordResetEmail(ctx.req, user.email, token);
        await recordSecurityEvent({ eventType: "password_reset_requested", userId: user.id, ipAddress });
      }
      return { success: true };
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(256), password: passwordSchema })).mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req.headers);
      await enforceAuthRateLimits({ action: "password_reset", email: hashApiKey(input.token), ipAddress });
      const token = await consumeAuthToken({ rawToken: input.token, purpose: "password_reset" });
      if (!token?.userId) throw new TRPCError3({ code: "BAD_REQUEST", message: "This reset link is invalid or expired" });
      const user = await updatePasswordAndRevokeSessions(token.userId, await hashPassword(input.password));
      if (!user) throw new TRPCError3({ code: "BAD_REQUEST", message: "Account access is unavailable" });
      await recordSecurityEvent({ eventType: "password_reset_completed", userId: user.id, ipAddress });
      return { success: true };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await endSession(ctx.req, ctx.res);
      return { success: true };
    })
  }),
  dashboard: router({ overview: protectedProcedure.query(({ ctx }) => getOverview(ctx.user.id)), analytics: protectedProcedure.query(({ ctx }) => getAnalytics(ctx.user.id)), credits: protectedProcedure.query(({ ctx }) => creditSummary(ctx.user.id)), announcements: protectedProcedure.query(() => listAnnouncements()), creditPacks: protectedProcedure.query(() => CREDIT_PACKS), checkoutCredits: protectedProcedure.input(z.object({ packId: z.enum(["sprout", "grove", "orchard"]) })).mutation(({ ctx, input }) => createCreditCheckout({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, packId: input.packId, origin: ctx.req.header("origin") ?? "http://localhost:3000" })) }),
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(({ ctx, input }) => createApiKey(ctx.user.id, input.name)),
    revoke: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => ({ success: await revokeApiKey(ctx.user.id, input.id) }))
  }),
  models: router({ list: protectedProcedure.query(() => listModels()) }),
  admin: router({
    economy: adminProcedure.query(() => getCreditEconomy()),
    users: adminProcedure.query(() => listUsers()),
    forensics: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getUserForensics(input.userId)),
    setUserDisabled: adminProcedure.input(z.object({ id: z.number().int().positive(), isDisabled: z.boolean() })).mutation(({ input, ctx }) => {
      if (input.id === ctx.user.id) throw new TRPCError3({ code: "FORBIDDEN", message: "The founder account is immutable" });
      return setUserDisabled(input.id, input.isDisabled);
    }),
    banUser: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(300).default("Founder security action") })).mutation(({ input, ctx }) => banUserAccess(input.id, ctx.user.id, input.reason)),
    mintCredits: adminProcedure.input(z.object({ email: emailSchema, amount: z.number().positive().max(1e6), description: z.string().trim().min(3).max(250) })).mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user) throw new TRPCError3({ code: "NOT_FOUND", message: "User not found" });
      return addCredits({ userId: user.id, amount: input.amount, bucket: "purchased", entryType: "grant", description: input.description });
    }),
    announcements: adminProcedure.query(() => listAnnouncements(false)),
    createAnnouncement: adminProcedure.input(z.object({ message: z.string().trim().min(3).max(1e3), kind: z.string().trim().min(2).max(24).default("notice"), creditsPerUser: z.number().min(0).max(1e5).default(0) })).mutation(({ input, ctx }) => createAnnouncement({ ...input, createdBy: ctx.user.id })),
    setAnnouncementActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ input }) => setAnnouncementActive(input.id, input.isActive)),
    models: adminProcedure.query(() => listModels(false)),
    createModel: adminProcedure.input(z.object({ slug: z.string().min(3).max(120), displayName: z.string().min(2).max(120), providerId: z.number().int().positive(), upstreamId: z.string().min(1).max(160), contextWindow: z.number().int().min(1).max(2e6), inputPrice: z.string(), outputPrice: z.string(), isEnabled: z.boolean() })).mutation(({ input }) => createModel(input)),
    updateModel: adminProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean().optional(), displayName: z.string().min(2).max(120).optional(), upstreamId: z.string().min(1).max(160).optional(), creditCostPer1kTokens: z.string().regex(/^\d+(\.\d{1,3})?$/).optional() })).mutation(({ input }) => {
      const { id, ...values } = input;
      return updateModel(id, values);
    }),
    providers: adminProcedure.query(() => listProviders()),
    syncProviderModels: adminProcedure.input(z.object({ providerId: z.number().int().positive() })).mutation(({ input }) => syncProviderModels(input.providerId)),
    saveProvider: adminProcedure.input(z.object({ slug: z.string().trim().min(2).max(50), displayName: z.string().trim().min(2).max(100), baseUrl: z.string().url(), apiKey: z.string().trim().min(1).optional(), isEnabled: z.boolean() })).mutation(({ input }) => {
      assertSafeUpstreamUrl(input.baseUrl);
      return saveProvider({ slug: input.slug, displayName: input.displayName, baseUrl: input.baseUrl, isEnabled: input.isEnabled, encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : void 0 });
    }),
    rateLimits: adminProcedure.query(() => getRateLimitSettings()),
    saveRateLimits: adminProcedure.input(z.object({ requestsPerMinute: z.number().int().min(1).max(1e4), tokensPerMinute: z.number().int().min(100).max(1e7) })).mutation(({ input }) => saveRateLimits(input)),
    setGlobalApiEnabled: adminProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ input }) => setGlobalApiEnabled(input.enabled)),
    seedDemo: adminProcedure.mutation(async ({ ctx }) => {
      await seedDemoData(ctx.user.id);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  return { req: opts.req, res: opts.res, user: await getSessionUser(opts.req) };
}

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/gateway.ts
import { Readable, Transform } from "node:stream";
import { z as z2 } from "zod";
function requestApiKey(req) {
  const authorization = req.header("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : req.header("x-api-key")?.trim();
}
function respondError(res, status, message, code) {
  return res.status(status).json({ error: { message, type: "gateway_error", code } });
}
var completionSchema = z2.object({
  model: z2.string().trim().min(1).max(120),
  messages: z2.array(z2.object({ role: z2.enum(["system", "user", "assistant", "tool"]).optional(), content: z2.union([z2.string().max(5e4), z2.array(z2.unknown()).max(32)]).optional() })).min(1).max(64),
  stream: z2.boolean().optional().default(false),
  max_tokens: z2.number().int().min(1).max(8192).optional(),
  stream_options: z2.record(z2.string(), z2.unknown()).optional()
}).strict();
function anthopicPayload(body, upstreamModel) {
  const messages = body.messages ?? [];
  const system = messages.filter((message) => message.role === "system" && typeof message.content === "string").map((message) => message.content).join("\n\n");
  return {
    model: upstreamModel,
    max_tokens: body.max_tokens ?? 1024,
    stream: Boolean(body.stream),
    ...system ? { system } : {},
    messages: messages.filter((message) => message.role === "user" || message.role === "assistant").map((message) => ({ role: message.role, content: typeof message.content === "string" ? message.content : "" }))
  };
}
function anthopicCompletion(payload, publicModel) {
  const inputTokens = Number(payload?.usage?.input_tokens ?? 0);
  const outputTokens = Number(payload?.usage?.output_tokens ?? 0);
  return {
    completion: {
      id: payload?.id ?? `chatcmpl_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1e3),
      model: publicModel,
      choices: [{
        index: 0,
        message: { role: "assistant", content: (payload?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("") },
        finish_reason: payload?.stop_reason ?? "stop"
      }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
    },
    inputTokens,
    outputTokens
  };
}
function createAnthropicSseAdapter(publicModel, usage) {
  let buffer = "";
  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.type === "message_start" && payload.message?.usage?.input_tokens !== void 0) usage.inputTokens = Number(payload.message.usage.input_tokens);
          if (payload.type === "message_delta" && payload.usage?.output_tokens !== void 0) usage.outputTokens = Number(payload.usage.output_tokens);
          if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
            this.push(`data: ${JSON.stringify({ id: payload.message?.id ?? `chatcmpl_${Date.now()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1e3), model: publicModel, choices: [{ index: 0, delta: { content: payload.delta.text }, finish_reason: null }] })}

`);
          }
          if (payload.type === "message_delta") {
            this.push(`data: ${JSON.stringify({ id: `chatcmpl_${Date.now()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1e3), model: publicModel, choices: [{ index: 0, delta: {}, finish_reason: payload.delta?.stop_reason ?? "stop" }] })}

`);
          }
          if (payload.type === "message_stop") this.push("data: [DONE]\n\n");
        } catch {
        }
      }
      callback();
    }
  });
}
function createOpenAiUsageObserver(usage) {
  let buffer = "";
  return new Transform({
    transform(chunk, _encoding, callback) {
      this.push(chunk);
      buffer += chunk.toString();
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine || dataLine === "data: [DONE]") continue;
        try {
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.usage) {
            usage.inputTokens = Number(payload.usage.prompt_tokens ?? usage.inputTokens);
            usage.outputTokens = Number(payload.usage.completion_tokens ?? usage.outputTokens);
          }
        } catch {
        }
      }
      callback();
    }
  });
}
function registerGateway(app) {
  app.get("/api/v1/health", (_req, res) => res.status(200).json({ status: "ok", service: "cloudhug-kiwi-router", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  app.get("/api/v1/models", async (req, res) => {
    const apiKey = requestApiKey(req);
    if (!apiKey) return respondError(res, 401, "Missing API key", "invalid_api_key");
    const owner = await getApiKeyOwner(apiKey);
    if (!owner) return respondError(res, 401, "Invalid or revoked API key", "invalid_api_key");
    const ipAddress = req.ip || getRequestIp(req.headers);
    if (await isAccessBanned(owner.user.id, owner.user.email, ipAddress)) return respondError(res, 403, "Access is blocked", "access_banned");
    const rate = await checkRateLimit(owner.user.id, ipAddress);
    if (!rate.allowed) return respondError(res, 429, "Rate limit exceeded", "rate_limit_exceeded");
    const available = await listModels(true);
    return res.json({ object: "list", data: available.map(({ model }) => ({ id: model.slug, object: "model", created: Math.floor(model.createdAt.getTime() / 1e3), owned_by: "cloudhug" })) });
  });
  app.post("/api/v1/chat/completions", async (req, res) => {
    const startedAt = Date.now();
    const apiKey = requestApiKey(req);
    if (!apiKey) return respondError(res, 401, "Missing API key", "invalid_api_key");
    const owner = await getApiKeyOwner(apiKey);
    if (!owner) return respondError(res, 401, "Invalid or revoked API key", "invalid_api_key");
    const ipAddress = req.ip || getRequestIp(req.headers);
    const userAgentHash = req.header("user-agent") ? hashApiKey(req.header("user-agent")) : void 0;
    if (await isAccessBanned(owner.user.id, owner.user.email, ipAddress)) return respondError(res, 403, "Access is blocked", "access_banned");
    const parsed = completionSchema.safeParse(req.body);
    if (!parsed.success) return respondError(res, 400, "Invalid chat completion payload", "invalid_request_error");
    const body = parsed.data;
    const rate = await checkRateLimit(owner.user.id, ipAddress);
    if (!rate.allowed) return respondError(res, 429, "Rate limit exceeded", "rate_limit_exceeded");
    const route = await getGatewayRoute(body.model);
    if (!route) return respondError(res, 404, `Model '${body.model}' is unavailable`, "model_not_found");
    const creditCheck = await canSpendCredits(owner.user, route.model.slug, body.max_tokens ?? 1024);
    if (!creditCheck.allowed) return respondError(res, 402, `Insufficient Kiwi Credits. ${creditCheck.required} credits are required; your balance is ${creditCheck.balance}.`, "insufficient_credits");
    if (!route.provider.encryptedApiKey) return respondError(res, 503, `The ${route.provider.displayName} provider is not configured`, "provider_not_configured");
    try {
      const isAnthropic = route.provider.slug === "anthropic";
      const baseUrl = assertSafeUpstreamUrl(route.provider.baseUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6e4);
      const upstream = await fetch(`${baseUrl.toString().replace(/\/$/, "")}${isAnthropic ? "/messages" : "/chat/completions"}`, {
        method: "POST",
        headers: isAnthropic ? { "Content-Type": "application/json", "x-api-key": decryptSecret(route.provider.encryptedApiKey), "anthropic-version": "2023-06-01" } : { "Content-Type": "application/json", Authorization: `Bearer ${decryptSecret(route.provider.encryptedApiKey)}` },
        body: JSON.stringify(isAnthropic ? anthopicPayload(body, route.model.upstreamId) : { ...body, model: route.model.upstreamId, ...body.stream ? { stream_options: { ...body.stream_options, include_usage: true } } : {} }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const metadata = { userId: owner.user.id, apiKeyId: owner.apiKey.id, modelSlug: route.model.slug, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt, ipAddress, userAgentHash };
      res.status(upstream.status);
      const type = upstream.headers.get("content-type") ?? "application/json";
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "no-cache, no-transform");
      if (!upstream.ok || !upstream.body) {
        const errorPayload = await upstream.text();
        await logRequest({ ...metadata, status: "error", errorCode: `upstream_${upstream.status}` });
        return res.send(errorPayload);
      }
      if (!body.stream) {
        if (isAnthropic) {
          const normalized = anthopicCompletion(await upstream.json(), route.model.slug);
          const creditsDeducted2 = await spendCredits(owner.user.id, route.model.slug, normalized.inputTokens, normalized.outputTokens, `Gateway completion ${route.model.slug}`);
          await logRequest({ ...metadata, status: "success", inputTokens: normalized.inputTokens, outputTokens: normalized.outputTokens, creditsDeducted: creditsDeducted2, latencyMs: Date.now() - startedAt });
          return res.json(normalized.completion);
        }
        const payload = await upstream.json();
        const inputTokens = Number(payload.usage?.prompt_tokens ?? 0);
        const outputTokens = Number(payload.usage?.completion_tokens ?? 0);
        const creditsDeducted = await spendCredits(owner.user.id, route.model.slug, inputTokens, outputTokens, `Gateway completion ${route.model.slug}`);
        await logRequest({ ...metadata, status: "success", inputTokens, outputTokens, creditsDeducted, latencyMs: Date.now() - startedAt });
        return res.json({ ...payload, model: route.model.slug });
      }
      const stream = Readable.fromWeb(upstream.body);
      const usage = { inputTokens: 0, outputTokens: 0 };
      const output = isAnthropic ? stream.pipe(createAnthropicSseAdapter(route.model.slug, usage)) : stream.pipe(createOpenAiUsageObserver(usage));
      output.on("end", () => {
        void (async () => {
          const creditsDeducted = await spendCredits(owner.user.id, route.model.slug, usage.inputTokens, usage.outputTokens, `Gateway stream ${route.model.slug}`);
          await logRequest({ ...metadata, status: "success", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, creditsDeducted, latencyMs: Date.now() - startedAt });
        })();
      });
      output.on("error", () => {
        void logRequest({ ...metadata, status: "error", latencyMs: Date.now() - startedAt, errorCode: "stream_error" });
      });
      output.pipe(res);
    } catch (error) {
      await logRequest({ userId: owner.user.id, apiKeyId: owner.apiKey.id, modelSlug: body.model, status: "error", inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt, errorCode: "gateway_network_error" });
      return respondError(res, 502, error instanceof Error ? error.message : "The upstream provider could not be reached", "upstream_error");
    }
  });
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/founderBootstrap.ts
async function ensureFounderAccount() {
  if (await getUserByEmail(FOUNDER_EMAIL)) {
    await promoteFounderRecord();
    return { created: false };
  }
  const password = process.env.FOUNDER_BOOTSTRAP_PASSWORD;
  if (!password) {
    console.warn("[Founder] Bootstrap password is not configured; the founder account will be created when the founder registers.");
    return { created: false };
  }
  await createUser({ name: "Kiwi Founder", email: FOUNDER_EMAIL, passwordHash: await hashPassword(password) });
  return { created: true };
}

// server/httpSecurity.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var configuredOrigins = () => (process.env.APP_URL || "").split(",").map((value) => value.trim()).filter(Boolean);
function allowOrigin(origin) {
  if (!origin) return true;
  const allowed = configuredOrigins();
  return allowed.length === 0 ? process.env.NODE_ENV !== "production" : allowed.includes(origin);
}
function securityHeaders(req, res, next) {
  const requestId = randomUUID2();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  if (process.env.NODE_ENV === "production" && !req.path.startsWith("/api/")) res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:");
  next();
}
function corsGuard(req, res, next) {
  const origin = req.header("origin");
  if (origin && allowOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (origin && !allowOrigin(origin)) return res.status(403).json({ error: "Origin is not allowed" });
  next();
}
async function globalApiRateLimit(req, res, next) {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const rate = await takeRateLimit({ scope: "http:ip", subject: ip, maxHits: 240, windowMs: 6e4 });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  } catch {
    return res.status(503).json({ error: "Request protection is temporarily unavailable" });
  }
}

// server/app.ts
async function createApp(options = {}) {
  const app = express2();
  app.set("trust proxy", 1);
  await ensureFounderAccount();
  registerStripeWebhook(app);
  app.use(securityHeaders);
  app.use(corsGuard);
  app.use(express2.json({ limit: "256kb", strict: true }));
  app.use(express2.urlencoded({ limit: "64kb", extended: false }));
  app.use("/api", globalApiRateLimit);
  app.use("/admin", async (req, res, next) => {
    const user = await getSessionUser(req);
    if (!user || user.email !== FOUNDER_EMAIL || user.role !== "founder") return res.status(403).json({ error: "Founder access required" });
    next();
  });
  app.post("/api/scheduled/daily-credits", async (req, res) => {
    if (!process.env.CREDIT_CRON_SECRET || req.header("x-kiwi-cron-secret") !== process.env.CREDIT_CRON_SECRET) return res.status(403).json({ error: "cron-only" });
    try {
      return res.json({ ok: true, ...await dailyCreditMaintenance() });
    } catch {
      return res.status(500).json({ error: "Daily credit maintenance failed" });
    }
  });
  app.all("/api/v1/.well-known/health-probe", async (req, res) => {
    await banIpAddress(req.ip || getRequestIp(req.headers) || "unknown", "Honeypot endpoint accessed");
    return res.status(404).json({ error: "Not found" });
  });
  registerStorageProxy(app);
  registerGateway(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (options.developmentServer) await setupVite(app, options.developmentServer);
  else if (options.serveStaticFiles) serveStatic(app);
  return app;
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port += 1) if (await isPortAvailable(port)) return port;
  throw new Error("No available application port found");
}
async function startServer() {
  const server = createServer();
  const app = await createApp({ developmentServer: server, serveStaticFiles: process.env.NODE_ENV === "production" });
  server.on("request", app);
  const port = await findAvailablePort(Number(process.env.PORT ?? 3e3));
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}
void startServer();
