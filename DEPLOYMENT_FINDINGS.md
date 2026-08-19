# Vercel Production Verification Findings

**URL checked:** https://kiwi-router.vercel.app/

The production root did not render the Cloudhug Kiwi Router landing page. Instead, it returned bundled server-side JavaScript beginning with `server/_core/index.ts` and application source modules. This indicates that Vercel is serving the Node bundle at the web root rather than the Vite public build.

The current production deployment must be corrected so static files under `dist/public` serve the SPA at public routes, while Vercel serverless functions under `api/` handle `/api/*` routes. The live endpoint verification cannot proceed until that routing/build-output issue is resolved.
