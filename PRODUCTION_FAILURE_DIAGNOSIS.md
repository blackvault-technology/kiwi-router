# Production API Failure Diagnosis — 2026-08-19

The user-reported production failures were:

- `GET /api/trpc/apiKeys.list?batch=1` → HTTP 500.
- `GET /api/trpc/admin.auditEvents?batch=1` → HTTP 500.
- `POST /api/v1/chat/completions` → HTTP 504.

Evidence collected from the live deployment and Neon project:

- `https://kiwi-router.vercel.app/api/v1/health` responds HTTP 200 JSON.
- `https://kiwi-router.vercel.app/api/status` responds HTTP 200 and reports Neon, gateway, model catalog, and provider configuration operational.
- Direct SQL reproduction of the admin audit query succeeds against Neon and returns rows from `public.security_events`, whose required columns exist.
- The actual Neon `public.api_keys` table is missing the `expires_at` column, even though the Drizzle schema and production code select/use `apiKeys.expiresAt` in `listApiKeys` and `getApiKeyOwner`.
- Therefore, the missing `api_keys.expires_at` migration is a confirmed root cause for `apiKeys.list` and likely for authenticated gateway requests before upstream routing.
- The admin audit SQL itself is valid on Neon; its HTTP 500 needs production-shaped serialization/route coverage after the schema fix. The audit query should cast the bigint `security_events.id` to text to avoid JSON serialization differences across runtimes.
- Vercel grouped runtime errors returned no clusters in the selected 24-hour window, so the user report likely reflects a prior/ephemeral invocation or an error not retained in the aggregate log window.

Next fixes: apply the additive `api_keys.expires_at` column migration to Neon, make audit IDs JSON-safe, add focused regression tests, then re-run TypeScript, Vitest, and production-shaped endpoint checks.
