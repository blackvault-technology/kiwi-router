# Provider Model Sync Validation

## Failure contract

`admin.syncProviderModels` remains founder-only and returns a structured result rather than propagating upstream, credential, payload, or timeout failures as an unhandled tRPC exception. The result includes `discovered`, `mode`, `ok`, `statusCode`, and `detail`; successful automatic discovery may also include `latencyMs`.

When credentials are missing, the response is `{ ok: false, statusCode: null }`. When an upstream `/models` request returns a non-2xx response, the response is `{ ok: false, statusCode: <upstream status> }`. Network errors, decryption failures, malformed payloads, and the eight-second timeout return `{ ok: false, statusCode: null }`. Details are generic and never include credentials or upstream response bodies.

On discovery failure, the provider is marked unhealthy and no model routes are inserted. On success, only payload entries with a string `id` are considered, discovered routes are inserted disabled, and the provider is marked healthy. Anthropic and Gemini retain manual route mode.

## Verification procedure

1. Run `pnpm exec tsc --noEmit` and `pnpm test -- --run`.
2. Save and deploy the checkpoint through the project management flow, then wait for the new Vercel production deployment.
3. Log in as `indiasikhotechno@gmail.com`, open the founder Providers panel, and run model synchronization against a provider with a rejected or missing credential.
4. Confirm the request returns a non-500 tRPC response, the console displays the safe detail message, and the provider health state becomes unhealthy.
5. Confirm a successful provider sync reports the discovered route count and inserts routes disabled by default.
6. Inspect production runtime logs for the tested deployment and confirm no credential, upstream body, or stack-trace details are exposed by the sync response.

The local implementation is covered by `server/provider-sync.contract.test.ts` and the full regression suite currently passes 64 tests.
