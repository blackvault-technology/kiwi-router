# UI validation notes

## 2026-08-19 — CloudHug landing rail

The local Kiwi Router landing page rendered successfully in a browser after replacing the oversized provider-icon dependency. The page presents the compact CloudHug badge, Kiwi Router wordmark, gateway endpoint panel, and animated rail for OpenAI, Anthropic, Google AI, Mistral, Groq, Cohere, and DeepSeek without a visible client error.

OpenAI, Mistral, Groq, and Cohere now use individual vector paths sourced from the MIT-licensed [Lobe Icons repository](https://github.com/lobehub/lobe-icons), while Anthropic, Google, and DeepSeek use the already-installed lightweight Simple Icons React components. The production build succeeded after the oversized package was removed.

## 2026-08-19 — Referral registration path

The public `/register` route now bypasses the authenticated-session query and renders immediately. Browser validation confirmed the responsive registration form includes full name, optional referral code, email, password, and account-creation controls. Referral links populate the input through the `ref` URL parameter and the submitted code is passed to the protected registration flow.

## 2026-08-19 — Documentation and legal routes

Browser validation confirmed the local developer documentation presents the canonical production origin `https://kiwi-router.vercel.app/api/v1`, complete endpoint examples, and the Kiwi Credits, coupon, referral, and error sections. The responsive Privacy Policy route also rendered correctly with account-data, security, retention, and legal-policy navigation content.

## 2026-08-19 — Public API status page

The local `/status` page was validated after its live check completed. It rendered the real component snapshot from `/api/status`: an operational Neon database and gateway, plus degraded model-catalog and provider-configuration states when zero enabled routes and configured providers were present. The page exposes latency, check time, a manual refresh control, and no provider credentials, URLs, account data, or raw database errors.

## 2026-08-19 — Authenticated responsive dashboard QA

An isolated production Chromium session authenticated the immutable founder account and verified **Overview, Playground, Models, API Keys, Analytics, and Admin** at both 1280 × 900 and 375 × 812 viewports. All 12 captures contained their expected view heading and reported no horizontal overflow. Direct visual inspection of the full-page mobile Overview and Admin captures confirmed readable metric cards, coupon and referral sections, credit-pack controls, founder-only controls, and the compact menu/credit header without clipping.

## 2026-08-19 — Comprehensive public-route QA

Production Chromium checks covered `/`, `/about`, `/docs`, `/status`, `/terms`, `/privacy`, `/acceptable-use`, and `/cookies` at 1280 × 900 and 375 × 812 viewports. All 16 captures rendered substantial page content and reported **no horizontal overflow**. This pass includes the mobile landing, product identity and About content, detailed API docs, live status page, and each legal policy page.

## 2026-08-19 — Founder control-center validation

The rebuilt founder workspace was validated in an isolated secure preview session at desktop and mobile breakpoints. All standard workspace routes plus the founder console rendered expected content with no horizontal overflow. Direct inspection of the 375 px Founder Console capture confirmed a compact mobile command center with the operational gateway switch, live-status link, horizontally scrollable management categories, credit and provider metrics, safety checklist, and quick actions for provider connections, routes, users, and coupons.

The upgraded control center was additionally validated after adding complete model-route editing and founder audit coverage. The founder-only tRPC execution tests exercised provider save, catalog test, synchronization, retirement, model creation, complete route updates, enablement changes, and route retirement; a standard-user caller was rejected before any protected helper executed. Render-level user-workspace tests confirmed that verified standard users receive focused API-key and gateway-test actions, while the founder context receives no user starter panel.

The provider and model-registry console categories were inspected directly at 375 px width. The provider screen presents a legible encrypted-connection form, routing enable switch, and safe inventory state. The model screen presents manual route creation, provider selection, and a route inventory that explicitly explains the preservation of historical usage and ledger data on retirement. The isolated tab QA confirmed all five founder categories at desktop and mobile with no horizontal overflow.
