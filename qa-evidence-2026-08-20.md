# Production QA Evidence — 2026-08-20

The connected browser opened `https://kiwi-router.vercel.app/login` and the app redirected the already authenticated non-founder session to `/app`, confirming the authenticated-entry redirect path. The live workspace rendered Overview, API Keys, Models, Analytics, and Playground navigation with no visible runtime error.

On `/app/api-keys`, the policy manager rendered correctly. With user confirmation, a temporary key named `temporary-release-qa-2026-08-20` was created with a one-day expiry (`2026-08-21`), a 1-credit cap, 5 requests/minute, and 1,000 tokens/minute. The live UI showed the key as Active and displayed the policy metadata. The raw secret was not copied into this file.

On `/app/playground`, Kiwi Auto Model was selected and the temporary key was entered into the password field. The prepared prompt was: `Explain why credit-aware model routing matters in two sentences.` The execution control is below the current viewport and still needs to be run. Do not publish, purchase credits, redeem coupons, or mutate referral data during this QA pass.

The live Playground completion succeeded through `kiwi/auto`. The response was a normal assistant answer explaining credit-aware routing, and the UI showed no HTML error, 5xx error, or leaked provider credentials. This confirms the credentialed end-to-end gateway path for the temporary policy key.
