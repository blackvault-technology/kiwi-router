# Resend delivery readiness

The connected Resend account contains the existing `blackvault.com` domain. Its status is currently `not_started`, so the Kiwi Router sender cannot be validated for real transactional delivery yet. Resend verification was triggered for domain ID `534d5879-0240-4241-ade5-30be83896c94` and will remain pending until the required DNS records are present.

Add these records at the DNS provider for `blackvault.com`:

| Type | Name | Value | Priority |
|---|---|---|---:|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC0jTVySoDK1LZOgIx6qIe44X1tnQRbZJaB2NRQNCEE1n3JZCkWbUSwQXFlM6ubtUz0/fU1wPHddqJBb/Ht6giZIpouAxP6sfFFvdEg7ek1vmt3wW0DKpiHpTemZzRcdTlEjUTLhcFqWaYtVUoiJT1ruxbVwOPZl4Abze+aqzAXJwIDAQAB` | — |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

After DNS propagation, run Resend domain verification again and set `RESEND_FROM_EMAIL` to a sender such as `Kiwi Router <auth@blackvault.com>`. The API key itself passed the lightweight Resend API check. The sender-domain test remains intentionally failing until the sender value is a valid address on the verified domain.
