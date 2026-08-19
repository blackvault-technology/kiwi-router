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
