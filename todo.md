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
