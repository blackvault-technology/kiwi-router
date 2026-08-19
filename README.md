# Cloudhug's Kiwi Router

Cloudhug's Kiwi Router is a Blackvault Technology and Cloud Hug by Blackvault Product. It is a verified-account, credit-aware AI gateway with a dark developer control plane, Neon PostgreSQL persistence, encrypted provider credentials, and an OpenAI-compatible API surface.

> **Leadership:** Adarsh Kushwah, CEO of Blackvault Technology.

## API Base URL

Use your deployed origin as the API base. For example, if the deployed site is `https://kiwi-router.vercel.app`, the endpoints are:

| Endpoint | Method | Purpose | Authentication |
|---|---:|---|---|
| `/api/v1/health` | `GET` | Public liveness response | None |
| `/api/v1/models` | `GET` | Lists enabled Kiwi model routes | Kiwi API key |
| `/api/v1/chat/completions` | `POST` | OpenAI-compatible chat completions and streams | Kiwi API key |

Create a verified account, then create an API key from the authenticated control plane. Raw keys are displayed once and are stored only as cryptographic hashes.

```bash
curl https://YOUR_DOMAIN/api/v1/models \
  -H "Authorization: Bearer kiwi_sk_your_key"

curl https://YOUR_DOMAIN/api/v1/chat/completions \
  -H "Authorization: Bearer kiwi_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kiwi/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello from Kiwi Router"}],
    "max_tokens": 256
  }'
```

### JavaScript / TypeScript

```ts
const response = await fetch("https://YOUR_DOMAIN/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.KIWI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "kiwi/gpt-4o-mini",
    messages: [{ role: "user", content: "Hello from TypeScript" }],
    max_tokens: 256,
  }),
});

if (!response.ok) throw new Error(`Kiwi Router request failed: ${response.status}`);
const completion = await response.json();
console.log(completion.choices[0].message.content);
```

### Python

```python
import os
import requests

response = requests.post(
    "https://YOUR_DOMAIN/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {os.environ['KIWI_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "kiwi/gpt-4o-mini",
        "messages": [{"role": "user", "content": "Hello from Python"}],
        "max_tokens": 256,
    },
    timeout=70,
)
response.raise_for_status()
print(response.json()["choices"][0]["message"]["content"])
```

## Account Security

Kiwi Router requires email verification before a user can receive an authenticated session. Password recovery uses short-lived, single-use, hashed tokens and revokes existing sessions after a password is changed. Authentication, API, and gateway paths are rate limited by IP, email, account, and key context; the application also records metadata-only security events.

The gateway does not persist prompts, completions, raw passwords, raw API keys, or raw email tokens in request logs. Provider credentials are encrypted before storage. The founder-only control plane remains reserved for `indiasikhotechno@gmail.com`.

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string. |
| `JWT_SECRET` | Strong, random server-only signing secret. |
| `ENCRYPTION_KEY` | Server-only provider-credential encryption key. |
| `FOUNDER_BOOTSTRAP_PASSWORD` | Bootstraps the immutable founder account on first start. |
| `RESEND_API_KEY` | Resend server key for verification and password-reset emails. |
| `RESEND_FROM_EMAIL` | A Resend-verified sender, such as `Cloudhug Kiwi Router <security@yourdomain.com>`. |
| `APP_URL` | Final HTTPS public origin; used for email links and CORS allowlisting. |
| `STRIPE_SECRET_KEY` | Stripe server key for credit-pack checkout. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for the client. |
| `CREDIT_CRON_SECRET` | Secret passed to the daily credit-maintenance callback. |

## Local Development

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

The development server exposes the landing page at `/`, documentation at `/docs`, About at `/about`, and the authenticated control plane at `/app`.

## Vercel Deployment

The repository contains `vercel.json` and serverless adapters under `api/`. Import `blackvault-technology/kiwi-router` into Vercel, then configure every required environment variable for **Production**, **Preview**, and **Development** as appropriate. Set `APP_URL` to the final production domain, configure the Stripe webhook as `https://YOUR_DOMAIN/api/stripe/webhook`, and set the Resend sender domain before enabling public registration.

Run the health check after deployment:

```bash
curl -i https://YOUR_DOMAIN/api/v1/health
```

Expect a `200` response with `status: "ok"` and security headers including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a request ID.

## Security Audit

The repository-level [security audit](./SECURITY_AUDIT.md) records the assessed threat surface, remediation work, and follow-up standard. Review it before changing gateway, authentication, provider, or deployment configuration.
