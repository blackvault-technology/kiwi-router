# Cloudhug Kiwi Router — Vercel Environment Variables

This guide lists the values required for the **Vercel Production** deployment at `https://kiwi-router.vercel.app`. Add the variables in **Vercel → Kiwi Router → Settings → Environment Variables**, select **Production**, and then create a **new deployment**. Vercel deployments use the environment-variable snapshot available when the deployment starts, so adding a value does not repair an already-built deployment.[1]

## Required for the API to start

| Variable | What to paste | Where to get it | Notes |
|---|---|---|---|
| `NEON_DATABASE_URL` | The full Neon PostgreSQL connection string, beginning with `postgresql://` | Neon Console → your Kiwi Router database project → **Connect** | This is mandatory. The present Vercel API startup failure is caused by this variable being absent. Use the connection string for the database that contains the Kiwi Router schema. |
| `JWT_SECRET` | A unique high-entropy secret | Generate it with `openssl rand -hex 32` | This signs browser session tokens. Do not reuse a Stripe, Neon, or Resend secret. |
| `ENCRYPTION_KEY` | A separate, unique high-entropy secret | Generate it with `openssl rand -hex 32` | This encrypts provider API credentials stored in Neon. Do not change it after provider credentials are stored, unless those credentials are re-encrypted. |
| `FOUNDER_BOOTSTRAP_PASSWORD` | `Mypass@2008` | The founder password supplied for this project | Used only to ensure the immutable founder account `indiasikhotechno@gmail.com` exists at startup. |
| `APP_URL` | `https://kiwi-router.vercel.app` | Copy exactly | Used in verification and password-reset links, plus allowlisted browser origins. |

> Keep all secret values private. Do not commit them to GitHub, add them to `vercel.json`, or paste them into frontend `VITE_*` variables. Vite variables are exposed to browsers at build time.[2]

## Required to activate credit purchases

| Variable | What to paste | Where to get it | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe **test** secret key, normally beginning `sk_test_` | Stripe Dashboard → Developers → API keys | Required for creating Stripe Checkout Sessions. Use live `sk_live_` only when moving to live payments. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint signing secret, normally beginning `whsec_` | Stripe Dashboard → Developers → Webhooks → Kiwi Router endpoint | Create or update an endpoint for `https://kiwi-router.vercel.app/api/stripe/webhook`, then copy its signing secret. |

The current project uses Stripe’s sandbox integration. Claim the sandbox in Stripe before relying on the generated test keys, then create the webhook endpoint in the same Stripe mode as the key.

## Required to activate verification and password-reset email

| Variable | What to paste | Where to get it | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | Resend API key, normally beginning `re_` | Resend Dashboard → API Keys | Required to send real verification and password-reset messages. |
| `RESEND_FROM_EMAIL` | A verified sender, for example `Kiwi Router <no-reply@your-domain.com>` | Resend Dashboard → Domains / verified sender | The domain must be verified in Resend. Until these are set, the app safely skips delivery rather than exposing mail credentials. |

## Required only when daily credit maintenance is scheduled

| Variable | What to paste | Where to get it | Notes |
|---|---|---|---|
| `CREDIT_CRON_SECRET` | A unique high-entropy secret | Generate it with `openssl rand -hex 32` | Required by the protected daily maintenance endpoint. Configure the scheduler to send this value only as the `x-kiwi-cron-secret` header. |

## Do **not** add these for the Vercel API

| Variable | Reason |
|---|---|
| `DATABASE_URL` | Kiwi Router’s application database uses `NEON_DATABASE_URL`, not the template’s legacy database variable. |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` | The product uses custom email/password JWT authentication; no OAuth configuration is required. |
| `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_API_URL` | These are managed-development integration values, not prerequisites for the public Vercel API. |
| `NODE_ENV`, `PORT` | Vercel manages the runtime environment and listening port. |

## Exact setup order

1. Open **Vercel → Kiwi Router → Settings → Environment Variables**.
2. Add the five variables in **Required for the API to start** to the **Production** environment.
3. Add Stripe variables if checkout should work immediately.
4. Add Resend variables after the sender domain is verified, if real email verification and password reset should work immediately.
5. Redeploy the project from the latest `main` commit.
6. Verify `https://kiwi-router.vercel.app/api/v1/health` returns HTTP `200` with a JSON body.
7. Verify `/api/v1/models` returns `401` JSON without an API key, confirming the route reaches the gateway rather than the SPA.

## Safe secret-generation commands

Run each command separately and use a different output for each variable.

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # CREDIT_CRON_SECRET, when scheduling maintenance
```

## References

[1] [Vercel — Environment Variables](https://vercel.com/docs/environment-variables)

[2] [Vite — Environment Variables and Modes](https://vite.dev/guide/env-and-mode.html)
