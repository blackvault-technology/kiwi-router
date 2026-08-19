import { bigserial, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin", "founder"]);
export const requestStatus = pgEnum("request_status", ["success", "error"]);
export const creditEntryType = pgEnum("credit_entry_type", ["grant", "airdrop", "purchase", "spend", "expiry"]);
export const creditBucket = pgEnum("credit_bucket", ["stipend", "purchased"]);
export const banScope = pgEnum("ban_scope", ["user", "ip", "email_domain"]);
export const authTokenPurpose = pgEnum("auth_token_purpose", ["email_verify", "password_reset"]);

export const users = pgTable("users", {
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("sessions_user_idx").on(table.userId)]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 24 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  lastFour: varchar("last_four", { length: 4 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("api_keys_hash_idx").on(table.keyHash), index("api_keys_user_idx").on(table.userId)]);

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  baseUrl: text("base_url").notNull(),
  encryptedApiKey: text("encrypted_api_key"),
  isHealthy: boolean("is_healthy").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("providers_slug_idx").on(table.slug)]);

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  upstreamId: varchar("upstream_id", { length: 160 }).notNull(),
  contextWindow: integer("context_window").notNull().default(128000),
  inputPrice: numeric("input_price", { precision: 12, scale: 6 }).notNull().default("0"),
  outputPrice: numeric("output_price", { precision: 12, scale: 6 }).notNull().default("0"),
  creditCostPer1kTokens: numeric("credit_cost_per_1k_tokens", { precision: 12, scale: 3 }).notNull().default("1"),
  routingConfig: jsonb("routing_config").notNull().default({ protocol: "openai" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("models_slug_idx").on(table.slug), index("models_provider_idx").on(table.providerId)]);

export const requestLogs = pgTable("request_logs", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("request_logs_user_created_idx").on(table.userId, table.createdAt), index("request_logs_key_created_idx").on(table.apiKeyId, table.createdAt)]);

export const usageDaily = pgTable("usage_daily", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  requests: integer("requests").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  totalLatencyMs: integer("total_latency_ms").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("usage_daily_user_day_idx").on(table.userId, table.day)]);

export const rateLimitSettings = pgTable("rate_limit_settings", {
  id: serial("id").primaryKey(),
  requestsPerMinute: integer("requests_per_minute").notNull().default(30),
  tokensPerMinute: integer("tokens_per_minute").notNull().default(10000),
  ipRequestsPerMinute: integer("ip_requests_per_minute").notNull().default(60),
  globalApiEnabled: boolean("global_api_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable("credit_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 3 }).notNull(),
  entryType: creditEntryType("entry_type").notNull(),
  bucket: creditBucket("bucket").notNull(),
  description: text("description").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("credit_ledger_user_created_idx").on(table.userId, table.createdAt), index("credit_ledger_expiry_idx").on(table.expiresAt)]);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("notice"),
  creditsPerUser: numeric("credits_per_user", { precision: 14, scale: 3 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginRecords = pgTable("login_records", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgentHash: varchar("user_agent_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("login_records_user_created_idx").on(table.userId, table.createdAt)]);

export const accessBans = pgTable("access_bans", {
  id: serial("id").primaryKey(),
  scope: banScope("scope").notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  reason: text("reason").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("access_bans_scope_value_idx").on(table.scope, table.value)]);

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  purpose: authTokenPurpose("purpose").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  requestIp: varchar("request_ip", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("auth_tokens_hash_idx").on(table.tokenHash), index("auth_tokens_email_purpose_idx").on(table.email, table.purpose)]);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 320 }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  hits: integer("hits").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("rate_limit_buckets_scope_subject_window_idx").on(table.scope, table.subject, table.windowStart), index("rate_limit_buckets_expiry_idx").on(table.windowStart)]);

export const securityEvents = pgTable("security_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("security_events_user_created_idx").on(table.userId, table.createdAt), index("security_events_type_created_idx").on(table.eventType, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
