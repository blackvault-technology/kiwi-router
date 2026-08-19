# Vercel Production Verification Findings

**URL checked:** https://kiwi-router.vercel.app/

The production root did not render the Cloudhug Kiwi Router landing page. Instead, it returned bundled server-side JavaScript beginning with `server/_core/index.ts` and application source modules. This indicates that Vercel is serving the Node bundle at the web root rather than the Vite public build.

The corrected configuration now keeps Vercel static files in `dist`, while the self-hosted Node bundle is built separately in `server-build`. Vercel serverless functions under `api/` handle `/api/*` routes.

## Post-fix verification

**Redeployed revision:** `87eb7afc452041fe21d6d5a097e91c5120953412`

The Vercel production deployment reached the `READY` state. A fresh browser check of https://kiwi-router.vercel.app/ rendered the **Kiwi Router** landing page with the expected public navigation and product content, rather than exposing the bundled Node server source. The root SPA routing issue is resolved.

The About deep link at https://kiwi-router.vercel.app/about also rendered the expected About page. However, https://kiwi-router.vercel.app/api/v1/health was incorrectly rewritten to the SPA login view instead of reaching the serverless API. The rewrites must explicitly reserve `/api/*` for the `api/[...path].ts` Vercel function before applying the SPA fallback.

After reserving `/api/*` and repairing the catch-all function entry point, the production health request reached Vercel Functions but returned `500 FUNCTION_INVOCATION_FAILED`. The Vercel deployment dashboard confirms the build is ready and two Node functions were generated. The detailed deployment log identifies the cause: `ERR_MODULE_NOT_FOUND` because the generated ESM catch-all function imports `/var/task/api/index` without a file extension. The catch-all source must use an ESM-resolvable `./index.js` specifier in Vercel’s generated runtime artifact.

The error persisted after moving the shared handler into `server/` because the committed catch-all source still contained a residual legacy `import handler from "./index";` line before the new import. That duplicate line was removed in revision `1ae6ca85`; the latest production health check must now be correlated with the fresh deployment log to distinguish a stale artifact from any remaining initialization error.

The bundled, Vite-free handler subsequently loaded successfully and returned a controlled `503` response. Its Vercel runtime log identifies the remaining startup blocker: **`NEON_DATABASE_URL must be configured`**. The Vercel project’s Environment Variables page shows **no project variables configured**, so the external deployment has not received the secrets that exist in the managed development environment.

Production recovery was verified after the required Vercel environment variables were configured. The live `/api/v1/health` endpoint returns HTTP `200` JSON with the expected security headers; unauthenticated `/api/v1/models` correctly returns HTTP `401`; `auth.me` returns HTTP `200`; and a founder sign-in for `indiasikhotechno@gmail.com` returns HTTP `200` with `emailVerified: true`. The production root no longer references the unset Umami script, removing the browser request that previously failed.

The authenticated production `dashboard.overview` tRPC procedure still returns HTTP `500`, which produces a client-side rendering failure when the dashboard expects the returned usage series to be an array. Vercel’s live log view confirms repeated 500 responses for this exact procedure; the error must be removed at the data-query layer and the client must degrade safely when telemetry data is unavailable.

The overview failure was resolved by normalizing Neon HTTP query results to their `rows` array before aggregating telemetry. After production deployment `dpl_3UvGW2SACT3tRqaCUrbax1bYCTqY`, the authenticated `dashboard.overview` procedure returns HTTP `200` JSON rather than the previous `analytics.reduce is not a function` error.

The deployed authenticated Overview page was then opened in the browser. It renders the workspace metrics, credit packs, announcement, and navigation successfully, with no recurrence of the earlier client-side `map` rendering failure.
