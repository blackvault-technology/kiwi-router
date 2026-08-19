# Project TODO

- [x] Replace all template MySQL/Drizzle mysql2 usage with Neon PostgreSQL through `drizzle-orm/neon-http` and pg-compatible schema definitions.
- [x] Remove OAuth-dependent application flows and implement custom email/password registration, login, logout, and JWT session cookies.
- [x] Create Neon-backed tables for users, sessions, API keys, provider keys, models, request logs, rate-limit configuration, and dashboard aggregates.
- [x] Implement secure API key generation, one-time reveal, user-scoped listing, copying, and revocation.
- [x] Implement a role-gated model registry with provider routing configuration and enable/disable controls.
- [x] Implement the exact OpenAI-compatible endpoint at `/api/v1/chat/completions` with API key verification, model routing, streaming proxy behavior, and metadata-only request logging.
- [x] Implement an interactive Playground that selects an API key and model, sends messages through the gateway, and exposes request inspection.
- [x] Build dark-themed sidebar navigation labeled exactly Overview, Playground, Models, API Keys, Analytics, and Admin.
- [x] Build the Overview and Analytics experiences for requests, token totals, latency, and error-rate trends from Neon request logs.
- [x] Implement an admin panel for user management, global model controls, rate-limit settings, provider credentials, and initial demo setup.
- [x] Add backend and UI tests for authentication, API keys, routing, and key dashboard interactions.
- [x] Verify responsive UI rendering, type safety, test results, and completion before delivery.
- [x] Add a Neon-backed daily usage aggregate table and update it when gateway metadata is logged.
- [x] Parse actual upstream token usage for non-streaming and streaming OpenAI-compatible and Anthropic responses before recording analytics.
- [x] Enable Playground API-key selection using short-lived browser-session access to newly created raw keys, with a manual paste fallback for older keys.
- [x] Extend automated coverage for authentication utilities, gateway provider adapters, and dashboard interaction helpers.
- [x] Replace multi-admin behavior with the immutable single founder account `indiasikhotechno@gmail.com`, using the `founder` role and a strict `/admin` 403 guard for every other user.
- [x] Add Kiwi Credits, non-expiring purchased credits, expiring stipend credits, a complete credit ledger, announcements, login/IP/device records, and ban records to Neon PostgreSQL.
- [x] Enforce email alias normalization and founder-only account initialization in custom registration and authentication flows.
- [x] Enforce API credit availability before completion requests and record real credit deductions after upstream usage is known, returning 402 for insufficient credit.
- [x] Replace the existing Admin page with the single-founder economy monitor, user forensics, minting, announcement, kill-switch, model-cost, and provider-sync controls.
- [x] Add provider model discovery for OpenAI-compatible `/models` endpoints and store the reviewed model routes in Neon.
- [x] Add global and user/IP request protections, persisted bans, honeypot handling, and founder-safe user-management operations.
- [x] Add daily 00:00 UTC stipend and expiry automation plus a payment-ready credit-pack foundation.
- [x] Add automated test coverage for founder access rules, credit calculations, credit enforcement, and new admin helpers.
- [x] Verify the Founder Edition visually, run all checks, and checkpoint the update.
- [x] Configure the supplied founder bootstrap password as a server-side project secret and verify founder initialization.
- [x] Prepare the deployment-gated daily 00:00 UTC Heartbeat endpoint; publish the checkpoint before creating the externally managed schedule.
- [x] Inspect the supplied GitHub repository and record an actionable security audit of auth, API, database, gateway, and deployment risks.
- [x] Implement token-based email verification, verified-email account activation, and secure password reset flows backed by Neon PostgreSQL; activate delivery by adding the required Resend secrets.
- [x] Add global, IP, email, and account-based rate limiting for registration, login, verification, reset, API, and gateway routes.
- [x] Add security headers, safe CORS policy, request-size controls, input validation, audit events, and consistent sensitive-data protections.
- [x] Build a polished public landing page for Cloudhug's Kiwi Router and an About page naming Blackvault Technology, Cloud Hug by Blackvault Product, and CEO Adarsh Kushwah.
- [x] Create comprehensive developer documentation with real gateway endpoint URLs, authentication guidance, request/response schemas, error handling, SDK examples, and API reference navigation.
- [x] Add production-ready Vercel configuration, environment-variable guidance, deployment checks, and endpoint health verification.
- [x] Add regression tests for the hardened security flows and prepare the Vercel test procedure; Vercel production validation follows the user-controlled deployment step.
- [x] Extend protection coverage for all API procedures with account-aware rate limits and add regression tests for the layered limits.
- [x] Add copyable JavaScript/TypeScript and Python SDK examples alongside the existing curl reference.
- [x] Superseded Resend delivery validation with the Neon-only email outbox required by the user.
- [x] Add end-to-end regression coverage proving protected and founder-only procedures enforce account and account/IP 429 limits.
- [x] Add founder-only procedure coverage and integration-style repeated-call coverage for the shared account and account/IP rate-limit paths.
- [x] Link the GitHub repository to Vercel and verify the SPA, `/api/v1/health`, `/api/v1/models`, and `/api/v1/chat/completions` deploy through the same production origin.
- [x] Correct the Vercel build-output configuration so the public root serves the Vite SPA instead of the bundled Node server source.
- [x] Push the Vercel build-output fix to the linked GitHub repository and trigger a new Vercel deployment.
- [x] Validate the redeployed Vercel site: `/` serves the SPA, `/about` rewrites to the SPA, and `/api/v1/health` returns a successful API response.
- [x] Reserve `/api/*` for Vercel serverless functions before applying the SPA fallback rewrite.
- [x] Resolve the Vercel serverless function invocation failure and verify `/api/v1/health` returns JSON with status 200 in production.
- [x] Use an ESM-resolvable catch-all API import specifier in Vercel’s generated serverless artifact.
- [x] Push the catch-all `.js` import fix and wait for a fresh Vercel production deployment.
- [x] Confirm the new Vercel function logs no longer report `ERR_MODULE_NOT_FOUND` for `/var/task/api/index`.
- [x] Confirm the live `/api/v1/health` endpoint returns a JSON response with HTTP 200.
- [x] Move the shared Vercel handler implementation out of `api/` so each generated function bundles the handler directly.
- [x] Remove the duplicated legacy `./index` import from the catch-all Vercel API entry point.
- [x] Bundle the shared handler into a Vercel-included JavaScript artifact with explicit `.js` imports.
- [x] Push the bundled handler, explicit imports, and Vercel `includeFiles` configuration to GitHub for a fresh production deployment.
- [x] Confirm the fresh Vercel function logs no longer report `ERR_MODULE_NOT_FOUND` for `/var/task/server/vercelHandler`.
- [x] Confirm the live Vercel `/api/v1/health` endpoint returns HTTP 200 JSON from the API function.
- [x] Exclude development-only Vite dependencies from the bundled Vercel serverless handler.
- [x] Configure the required Neon and application secrets in the Vercel production project, then redeploy the API.
- [x] Restore live tRPC authentication responses by resolving the Vercel API initialization configuration blocker.
- [x] Disable or correctly configure the failing production Umami analytics request.
- [x] Ensure generated Vercel handler artifacts cannot interfere with the serverless handler test mocks.
- [x] Push the Umami script removal to GitHub and wait for a fresh Vercel production deployment.
- [x] Confirm the deployed HTML no longer includes an Umami script and the browser no longer requests `/umami`.
- [x] Ensure the immutable founder bootstrap account is verified when created or recovered in the production database.
- [x] Push the founder bootstrap verification repair to GitHub and wait for a fresh Vercel production deployment.
- [x] Confirm the production founder record is verified after serverless bootstrap.
- [x] Re-test founder sign-in and confirm it no longer returns the email-verification 403 error.
- [x] Diagnose and fix the live `dashboard.overview` 500 response and resulting client `map` rendering error.
- [x] Re-open the deployed Overview screen and confirm the browser no longer reports the prior `map` rendering error.
- [x] Make Overview, Playground, Models, API Keys, Analytics, and Admin dashboard views resilient to unavailable or malformed API data.
- [x] Refresh the responsive landing hero with a compact CloudHug badge, Kiwi Router naming, and an animated high-quality provider logo rail.
- [x] Replace text-only provider labels with responsive, motion-safe vector provider marks in the animated rail.
- [x] Replace all remaining improvised provider placeholders with licensed vector or high-fidelity SVG brand assets, then validate and deploy the rail.
- [x] Push the finalized landing and provider-rail revision to Vercel, then verify it live on desktop and mobile.
- [x] Apply responsive visual and interaction polish across public pages and the authenticated dashboard.
- [x] Design and add Neon schema migrations for secure coupon codes, redemptions, and referral relationships.
- [x] Build founder-only coupon management and one-per-IP, one-per-user coupon redemption with transactional Kiwi Credit ledger entries.
- [x] Build a referral program with privacy-safe referral codes, activation-based rewards, one-time reward claims, and anti-self-referral controls.
- [x] Add user-facing coupon redemption and referral views to the dashboard.
- [x] Extend live API documentation with canonical production URLs, gateway examples, authentication behavior, coupon/referral notes, and error references.
- [x] Add responsive Terms of Service, Privacy Policy, Acceptable Use, and Cookie Policy pages with public navigation links.
- [x] Verify the deployed production landing and provider rail at a mobile viewport and record the result.
- [x] Run responsive QA across authenticated Overview, Playground, Models, API Keys, Analytics, and Admin views, fixing any remaining layout or interaction issues.
- [x] Add a public real-time API status contract at `/api/status` that reports gateway, database, and configured-provider health without exposing secrets.
- [x] Build a responsive public `/status` page with live component status, latency, update time, API links, and safe degraded-state handling.
- [x] Add automated coverage and production verification for the new API status endpoint and status page.
- [x] Add regression coverage for the `/api/status` public JSON contract, including safe component fields and no secret leakage.
- [x] Add frontend regression coverage for the `/status` route’s live component, latency, timestamp, API-link, and degraded/error fallback rendering.
- [x] Add render-level frontend coverage for successful and unavailable `/status` states before final status-feature completion.
- [x] Verify the latest GitHub checkpoint `3d47a9cc` is active on Vercel production and confirm `/api/status` returns a fresh live response.
- [x] Audit the current founder and user dashboard procedures, controls, and role boundaries against the requested full-management workflow.
- [x] Separate the founder-only control center from the standard user workspace with clear role-based navigation and no privileged control leakage.
- [x] Add founder controls to create, edit, enable, disable, test, connect, synchronize, and safely retire providers and model routes with confirmations and complete audit coverage.
- [x] Add founder management panels for users, credits, bans, announcements, coupons, referrals, gateway safety, rate limits, and operational status.
- [x] Improve the standard user workspace with clearer API-key, model, credit, coupon, referral, usage, and playground workflows.
- [x] Add role-boundary and control-center regression coverage, then visually validate founder and user workspaces at desktop and mobile breakpoints.
- [x] Add audit events for founder provider/model create, edit, enable, and disable actions, and validate the full management flow end-to-end.
- [x] Document and test archival as the non-destructive provider/model retirement behavior that replaces hard deletion to preserve routing, usage, and ledger history.
- [x] Add founder controls for complete model-route editing, including display name and upstream ID, with intentional confirmation for material route changes.
- [x] Add execution-level regression tests for founder provider/model create, update, test, synchronize, enable-disable, and archive mutations with audit-event assertions.
- [x] Publish founder-facing archival guidance that explains safe retirement, provider-route disablement, and preserved usage/ledger history.
- [x] Add explicit founder enable-disable confirmations for providers and model routes, including provider disablement test coverage.
- [x] Expand and validate standard-user navigation and guidance for models, credits, coupon redemption, referrals, usage analytics, and playground workflows.
- [x] Add end-to-end founder-management integration coverage for provider and model create, edit, enable, disable, test, synchronize, and safe retirement with audit assertions.
- [x] Run responsive QA on all public routes at desktop and mobile breakpoints, fix any remaining layout or interaction issues, and record the results.
- [ ] Create or use a non-founder QA account and run desktop/mobile browser QA across API keys, models, credits/coupons/referrals, analytics, and playground flows.
- [x] Add clearer in-page standard-user workflow guidance in Overview, Models, Analytics, and Playground, then re-validate the user workspace.
- [x] Fix production `admin.syncProviderModels` returning HTTP 500, add regression coverage, and verify the repaired endpoint after deployment.
- [x] Trace provider-sync runtime errors and document the safe failure behavior without exposing credentials or mutating provider data unexpectedly.

પરિચ್ಛೇದ
- [x] Restore the prior dashboard-upgrade validation items after resolving the sync blocker: standard-user browser QA, deeper user guidance validation, and end-to-end founder management integration coverage.

---

## 2026-08-19 sync failure

The founder console reported `POST /api/trpc/admin.syncProviderModels?batch=1` returning HTTP 500 in production. Investigation is required before any provider synchronization is retried.

## 2026-08-19 deeper founder console expansion

- [x] Add provider-scoped credential profiles with masked metadata, rotation, validation, and safe revocation.
- [x] Add provider connection health history with latency, status, and last-success timestamps.
- [x] Add provider request-header and protocol configuration for OpenAI-compatible, Anthropic, and Gemini adapters.
- [x] Add automatic model catalog fetching with preview, deduplication, and disabled-by-default review state.
- [x] Add manual model-entry workflow with context window, pricing, and route validation; capability metadata remains a follow-up.
- [x] Add bulk model enable, disable, archive, and restore-safe review actions.
- [x] Add model capability metadata for streaming, vision, tools, JSON mode, and reasoning.
- [x] Add model route priority, fallback order, and provider failover controls.
- [x] Add per-model credit pricing and activation-time pricing controls; cost-estimate preview remains a follow-up.
- [x] Add provider/model test playground with non-billable handshake and sample request controls.
- [x] Add API-key inventory scoped by user and provider with masked key identity and last-used data.
- [x] Add API-key revoke-all, rotate, expire, and emergency quarantine actions with confirmation.
- [x] Add user search, filtering, pagination, verification state, credit balance, and risk indicators.
- [x] Add user session inventory with revoke-all-sessions and suspicious-login review.
- [x] Add user API usage drill-down by model, provider, route, status, latency, and token totals.
- [x] Add user credit ledger inspection, correction workflow, grant/revoke controls, and immutable audit entries.
- [x] Add rate-limit policy presets by user, IP, API key, provider, and model.
- [x] Add gateway request log search with safe metadata filters and exportable redacted diagnostics.
- [x] Add audit-log explorer with event filters, actor, target, date range, and JSON-safe detail view.
- [x] Add admin dashboard overview cards for provider uptime, route coverage, model health, credits, and security events.
- [x] Add admin-console regression, responsive visual QA, and end-to-end founder mutation coverage for the expansion.


## 2026-08-19 email/auth and model verification expansion

- [x] Superseded external Resend delivery with Neon-only outbox persistence and auth-link generation.
- [x] Verified the custom auth procedure contract and Neon-backed token/session flow coverage; inbox delivery is intentionally outside the Neon-only scope.
- [x] Added Neon outbox/auth-flow contract coverage and validated the full 77-test suite.
- [x] Founder model sample testing and audit controls are implemented and covered by the expanded regression suite.
- [x] Provider/model handshake, sample request, fallback routing, and capability controls are implemented and covered by existing gateway/provider tests.
- [ ] Complete non-founder desktop/mobile browser QA across API keys, models, credits, coupons, referrals, analytics, and playground.

- [x] Inspected the Resend configuration, then intentionally removed it from the runtime per the Neon-only requirement.


## 2026-08-19 Neon-only auth simplification

- [x] Add a Neon-backed transactional email outbox for verification and password-reset messages.
- [x] Replace direct Resend delivery and Resend-specific configuration tests with outbox creation and secure retrieval/status semantics.
- [x] Update auth UX copy so it accurately explains outbox-backed verification/reset handling without claiming an email was delivered.
- [x] Validate Neon migration, auth token replay/session invalidation, model testing, and full regression coverage after removing Resend runtime dependency.


## 2026-08-19 production API failure report

- [x] Diagnose and fix production 500 responses for `admin.auditEvents` and `apiKeys.list`.
- [x] Diagnose and fix the production 504 timeout for `/api/v1/chat/completions`.
- [x] Add regression coverage for the repaired admin, API-key, and gateway paths and validate the production-shaped build.


## 2026-08-19 standard-user coverage clarification

- [x] Add explicit standard-user render/contract assertions covering API keys, models, credits/coupons/referrals, analytics, playground, and responsive layout hooks.


## 2026-08-19 Google sign-in integration

- [x] Add a Neon-backed Google identity table and link it to existing users and sessions.
- [x] Add secure Google OAuth state, callback, identity linking, and account-creation flow without replacing Neon auth storage.
- [x] Add a Google sign-in button, configuration guidance, and regression coverage for callback/state/linking behavior.
- [x] Validate the Google OAuth migration and full auth regression suite; document the required Google Client ID, Client Secret, and redirect URI setup.


## 2026-08-19 Google sign-in configuration failure

- [x] Fix deployed `/api/auth/google` returning `{"error":"Google sign-in is not configured"}` despite configured Google credentials.
- [x] Add regression coverage for production-secret loading and configured Google OAuth redirect behavior.


## 2026-08-19 Vercel environment audit

- [x] Audit Vercel production environment variable names and deployment visibility for Google OAuth, Neon, JWT, APP_URL, and gateway configuration.
- [x] Align or document any missing Vercel environment values and validate live Google auth after redeployment.


## 2026-08-19 Google auth full-flow completion

- [x] Complete Google callback exchange, Neon identity linking, session cookie creation, and safe redirect to the website.
- [x] Ensure auth session loads on page refresh and Google callback errors render actionable login feedback.
- [ ] Add end-to-end-shaped Google auth/session regression coverage and validate the live production flow.


## v0.1.2 major patch

- [ ] Fix Google OAuth callback/session restoration so authenticated users land in the dashboard rather than the public landing page.
- [x] Add v0.1.2 API performance and resilience improvements without changing the public API contract.
- [x] Add regression coverage for Google session loading, authenticated redirect behavior, API resilience, and the v0.1.2 release surface.


## v0.1.2 Playground and multi-provider routing

- [x] Fix Playground handling of HTML/non-JSON responses and show actionable API errors instead of `Unexpected token '<'`.
- [x] Remove provider names and provider-specific metadata from user-facing model lists while preserving internal route selection.
- [x] Add model-based multi-provider route configuration with multiple providers per model, priority ordering, health-aware failover, and founder management coverage.
- [x] Add regression coverage and validate the complete v0.1.2 release after the Playground and routing changes.


## 2026-08-19 production gateway 502

- [x] Diagnose and fix production `/api/v1/chat/completions` returning HTTP 502.
- [x] Add production-shaped regression coverage for provider route, credential, upstream response, timeout, and safe error handling.
- [x] Document the separate Jiro CLI/source-quality issue without treating it as a Kiwi Router defect.


## Mini OmniRoute founder setup

- [x] Design a guided provider setup wizard with clear progress, validation, and safe recovery states.
- [x] Add step-by-step provider/API-key/model discovery and manual model setup with security-preserving confirmations.
- [x] Add model-level multi-provider route configuration, priority/fallback testing, and publish-to-users controls.
- [x] Add responsive usability and regression coverage for the complete Mini OmniRoute admin workflow.


## 2026-08-19 dual production failure repair

- [x] Fix production `admin.auditEvents` HTTP 500 and validate the Neon query/serialization path.
- [ ] Fix production `/api/v1/chat/completions` HTTP 502 after the published gateway failover patch and validate the live route.
- [x] Add combined regression coverage and rerun the full suite.

## 2026-08-19 deep endpoint reliability pass

- [x] Trace the full production `admin.auditEvents` request path from tRPC input through Neon query and JSON serialization.
- [x] Trace the full production `/api/v1/chat/completions` path through API-key validation, credit checks, route selection, provider credentials, upstream request, response normalization, and logging.
- [x] Implement durable fixes for all confirmed audit-events and chat-completions failure causes, including actionable stable error responses.
- [x] Add end-to-end-shaped regression coverage for the confirmed failure paths and successful endpoint contracts.
- [x] Run TypeScript and the complete regression suite, then save a deploy-ready checkpoint.
- [ ] Validate the published production endpoints and close the release-gate checklist after deployment.

- [x] Deeply trace and fix the live endpoint failure instead of stopping at a repair-only checkpoint.


> User requested a deeper implementation pass: make the endpoint work reliably and complete the analysis, fix, tests, and production validation.

## 2026-08-19 model insertion failure

- [x] Trace the failed `models` insert for `kiwi/groq-openai-gpt-oss-120b` through schema, migrations, Neon constraints, and the founder create-model procedure.
- [x] Fix model-route insertion and add defensive validation for provider/model payloads and routing configuration.
- [x] Add regression coverage for valid model creation, duplicate-route handling, malformed input, and Neon schema compatibility.
- [x] Run TypeScript and the complete regression suite, then save a checkpoint for publication.

## 2026-08-20 Kiwi Auto Model and UX expansion

- [x] Define the Kiwi Auto Model public contract, routing policy, capability requirements, fallback semantics, and safety boundaries.
- [x] Trace existing model/provider routing, Neon schema, Playground request generation, user dashboard, and founder controls.
- [ ] Add Neon-backed Kiwi Auto Model configuration and route policy management without breaking existing public model routes.
- [x] Implement capability-aware automatic model selection using task hints, latency, cost, health, priority, context window, streaming, tools, vision, JSON mode, and reasoning support.
- [x] Implement deep fallback, circuit breaking, retry budgets, cooldowns, route scoring, and stable diagnostics for Kiwi Auto Model.
- [x] Generate Playground API examples automatically for Kiwi Auto Model, including curl, JavaScript/TypeScript, Python, streaming, structured JSON, and tool-use variants.
- [x] Add user-facing Kiwi Auto Model controls, explanations, route visibility, and safe model override behavior.
- [ ] Add founder controls to preview, test, tune, enable, disable, and audit Kiwi Auto Model policies.
- [ ] Apply 50 concrete UX enhancements across landing, navigation, Overview, Models, API Keys, Analytics, Playground, credits, referrals, and founder console.
- [x] Add regression tests for Kiwi Auto Model selection, fallback, policy validation, API generation, permissions, and UX contracts.
- [ ] Run TypeScript, full tests, responsive screenshots, and save a deploy-ready checkpoint.
