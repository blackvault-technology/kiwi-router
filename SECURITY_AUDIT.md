# Cloudhug's Kiwi Router Security Audit

## Scope

This audit covers the current custom email/password authentication, JWT session cookies, Neon PostgreSQL persistence, tRPC API, OpenAI-compatible gateway, Stripe credit flow, and Express deployment surface.

## Findings and Remediation Plan

| Priority | Finding | Risk | Remediation |
|---|---|---|---|
| Critical | Registration starts a session before the mailbox is verified. | Unverified or typo-controlled accounts can consume platform resources. | Require a one-time, hashed verification token before issuing an authenticated session. |
| Critical | Login and registration have no IP, email, or account throttling. | Credential stuffing, password spraying, registration abuse, and expensive password-hash denial of service. | Add Neon-backed fixed-window limits with fail-closed checks across registration, login, verification, reset, and all API procedures. |
| High | Password recovery is not implemented. | Users cannot securely regain access. | Add generic-response recovery requests, short-lived single-use hashed reset tokens, session revocation, and audited password updates. |
| High | Gateway allows wildcard CORS and lacks request-shape limits. | Cross-origin key misuse and oversized/abusive gateway requests. | Restrict CORS by configured origins, cap body/message sizes, validate the completion contract, cap generation limits, and apply concurrent/IP/user/key controls. |
| High | Provider base URLs are administrator supplied with no network guard. | A compromised founder session could create SSRF-like outbound requests. | Enforce HTTPS, reject private/loopback hostnames, and add timeouts plus abort handling to all upstream fetches. |
| Medium | Security headers, CSP, request correlation, and general tRPC throttling are absent. | Reduced browser-layer protection and limited incident traceability. | Add strict baseline headers, nonce-free CSP, request IDs, structured security events, and router-wide rate-limit middleware. |
| Medium | Sessions do not rotate on password reset and do not record security metadata. | Persisted sessions remain usable after account recovery. | Revoke all sessions after reset and retain redacted audit events. |
| Medium | Credit deduction is post-upstream and can be raced by concurrent requests. | Overspend risk during concurrent traffic. | Reserve a bounded credit allowance before the upstream call, then settle actual usage or release the reserve. |

## Delivery Standard

The remediation will preserve Neon PostgreSQL as the single data store, avoid logging prompts, completions, passwords, raw API keys, reset tokens, or verification tokens, and verify every security-sensitive flow with automated tests.
