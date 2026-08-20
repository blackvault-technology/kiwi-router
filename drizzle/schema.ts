import { bigint, bigserial, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin", "founder"]);
export const requestStatus = pgEnum("request_status", ["success", "error"]);
export const creditEntryType = pgEnum("credit_entry_type", ["grant", "airdrop", "purchase", "spend", "expiry"]);
export const creditBucket = pgEnum("credit_bucket", ["stipend", "purchased"]);
export const banScope = pgEnum("ban_scope", ["user", "ip", "email_domain"]);
export const authTokenPurpose = pgEnum("auth_token_purpose", ["email_verify", "password_reset"]);
export const emailOutboxStatus = pgEnum("email_outbox_status", ["pending", "claimed", "sent", "failed"]);
export const referralStatus = pgEnum("referral_status", ["pending", "activated", "rejected"]);

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
  referralCode: varchar("referral_code", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("users_email_idx").on(table.email), uniqueIndex("users_referral_code_idx").on(table.referralCode)]);

export const googleIdentities = pgTable("google_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  googleSubject: varchar("google_subject", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("google_identities_user_idx").on(table.userId)]);

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
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("api_keys_hash_idx").on(table.keyHash), index("api_keys_user_idx").on(table.userId)]);

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  baseUrl: text("base_url").notNull(),
  protocol: varchar("protocol", { length: 24 }).notNull().default("openai"),
  requestHeaders: jsonb("request_headers").notNull().default({}),
  encryptedApiKey: text("encrypted_api_key"),
  isHealthy: boolean("is_healthy").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("providers_slug_idx").on(table.slug)]);

export const providerCredentials = pgTable("provider_credentials", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  keyHint: varchar("key_hint", { length: 16 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  lastTestLatencyMs: integer("last_test_latency_ms"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("provider_credentials_provider_name_idx").on(table.providerId, table.name), index("provider_credentials_provider_idx").on(table.providerId)]);

export const providerHealthChecks = pgTable("provider_health_checks", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  credentialId: integer("credential_id").references(() => providerCredentials.id, { onDelete: "set null" }),
  ok: boolean("ok").notNull(),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms").notNull().default(0),
  detail: varchar("detail", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("provider_health_checks_provider_created_idx").on(table.providerId, table.createdAt)]);

export const apiKeyProviderAccess = pgTable("api_key_provider_access", {
  id: serial("id").primaryKey(),
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("api_key_provider_access_key_provider_idx").on(table.apiKeyId, table.providerId), index("api_key_provider_access_provider_idx").on(table.providerId)]);

export const modelIdentities = pgTable("model_identities", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("model_identities_slug_idx").on(table.slug)]);

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  identityId: integer("identity_id").references(() => modelIdentities.id, { onDelete: "set null" }),
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
}, table => [uniqueIndex("models_slug_provider_upstream_idx").on(table.slug, table.providerId, table.upstreamId), index("models_slug_priority_idx").on(table.slug), index("models_identity_idx").on(table.identityId), index("models_provider_idx").on(table.providerId)]);

export const autoRoutePolicies = pgTable("auto_route_policies", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().default("kiwi/auto"),
  displayName: varchar("display_name", { length: 120 }).notNull().default("Kiwi Auto Model"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  maxCostPer1k: numeric("max_cost_per_1k", { precision: 12, scale: 3 }).notNull().default("1000"),
  latencyBudgetMs: integer("latency_budget_ms").notNull().default(45000),
  minContextWindow: integer("min_context_window").notNull().default(4096),
  requireHealthy: boolean("require_healthy").notNull().default(true),
  fallbackOn5xx: boolean("fallback_on_5xx").notNull().default(true),
  fallbackOnTimeout: boolean("fallback_on_timeout").notNull().default(true),
  routingConfig: jsonb("routing_config").notNull().default({}),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("auto_route_policies_slug_idx").on(table.slug)]);

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

export const rateLimitPolicies = pgTable("rate_limit_policies", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 24 }).notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  requestsPerMinute: integer("requests_per_minute").notNull().default(30),
  tokensPerMinute: integer("tokens_per_minute").notNull().default(10000),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("rate_limit_policies_scope_subject_idx").on(table.scope, table.subject), index("rate_limit_policies_scope_idx").on(table.scope)]);

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

export const couponCodes = pgTable("coupon_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull(),
  creditsAmount: numeric("credits_amount", { precision: 14, scale: 3 }).notNull(),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("coupon_codes_code_idx").on(table.code), index("coupon_codes_active_expiry_idx").on(table.isActive, table.expiresAt)]);

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => couponCodes.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  ledgerEntryId: bigint("ledger_entry_id", { mode: "number" }).references(() => creditLedger.id, { onDelete: "set null" }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("coupon_redemptions_coupon_user_idx").on(table.couponId, table.userId),
  uniqueIndex("coupon_redemptions_coupon_ip_idx").on(table.couponId, table.ipHash),
  index("coupon_redemptions_user_created_idx").on(table.userId, table.redeemedAt),
]);

export const referrals = pgTable("referrals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  referrerUserId: integer("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: integer("referred_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referralCode: varchar("referral_code", { length: 32 }).notNull(),
  status: referralStatus("status").notNull().default("pending"),
  signupIpHash: varchar("signup_ip_hash", { length: 64 }).notNull(),
  deviceHash: varchar("device_hash", { length: 64 }),
  referrerRewardCredits: numeric("referrer_reward_credits", { precision: 14, scale: 3 }).notNull().default("0"),
  referredRewardCredits: numeric("referred_reward_credits", { precision: 14, scale: 3 }).notNull().default("0"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  referrerRewardClaimedAt: timestamp("referrer_reward_claimed_at", { withTimezone: true }),
  referredRewardClaimedAt: timestamp("referred_reward_claimed_at", { withTimezone: true }),
  referrerLedgerEntryId: bigint("referrer_ledger_entry_id", { mode: "number" }).references(() => creditLedger.id, { onDelete: "set null" }),
  referredLedgerEntryId: bigint("referred_ledger_entry_id", { mode: "number" }).references(() => creditLedger.id, { onDelete: "set null" }),
  rejectionReason: varchar("rejection_reason", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("referrals_referred_user_idx").on(table.referredUserId),
  uniqueIndex("referrals_signup_ip_idx").on(table.signupIpHash),
  uniqueIndex("referrals_device_idx").on(table.deviceHash),
  index("referrals_referrer_status_idx").on(table.referrerUserId, table.status),
  index("referrals_referral_code_idx").on(table.referralCode),
]);

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

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  purpose: authTokenPurpose("purpose").notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  status: emailOutboxStatus("status").notNull().default("pending"),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  failureReason: varchar("failure_reason", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("email_outbox_status_available_idx").on(table.status, table.availableAt), index("email_outbox_email_created_idx").on(table.email, table.createdAt)]);

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
