# Production API-key lifecycle evidence

On 2026-08-20, an authenticated standard-user production session created a temporary key named `temporary-final-qa-2026-08-20` with a next-day expiry, a 1.000-credit total cap, a 5 request-per-minute limit, and a 1,000 token-per-minute limit.

The live API Keys list rendered the new record as active and displayed the masked key identifier, expiry date, credit cap, request limit, and token limit. The raw one-time secret was intentionally not recorded in this evidence file. The key is now ready for the authorized revoke-and-confirm-zero cleanup step.

The authorized revoke action completed successfully. The production UI confirmed the record was **Revoked** and removed its revoke control. The list preserves one revoked key as non-destructive credential history; therefore the verified cleanup condition is **zero active keys**, rather than zero historical records.

## Final public security probes

The published `/api/status` response reported operational database, gateway, model-catalog, and provider components without including secrets. The published `/api/v1/models` endpoint returned the expected safe JSON `invalid_api_key` response when called without credentials. A POST request to `/api/v1/chat/completions` without an API key returned HTTP 401 JSON and included hardened transport/security response headers.

## Mobile QA limitation

The connected authenticated browser session was available only at its existing desktop viewport. Shell-level desktop and narrow-mobile captures were completed during implementation, but a true authenticated mobile browser session could not be programmatically resized or independently opened. This is documented as an environment limitation; no unverified authenticated-mobile claim is made.
