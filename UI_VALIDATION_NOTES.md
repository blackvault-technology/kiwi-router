# UI validation notes

## 2026-08-19 — CloudHug landing rail

The local Kiwi Router landing page rendered successfully in a browser after replacing the oversized provider-icon dependency. The page presents the compact CloudHug badge, Kiwi Router wordmark, gateway endpoint panel, and animated rail for OpenAI, Anthropic, Google AI, Mistral, Groq, Cohere, and DeepSeek without a visible client error.

OpenAI, Mistral, Groq, and Cohere now use individual vector paths sourced from the MIT-licensed [Lobe Icons repository](https://github.com/lobehub/lobe-icons), while Anthropic, Google, and DeepSeek use the already-installed lightweight Simple Icons React components. The production build succeeded after the oversized package was removed.

## 2026-08-19 — Referral registration path

The public `/register` route now bypasses the authenticated-session query and renders immediately. Browser validation confirmed the responsive registration form includes full name, optional referral code, email, password, and account-creation controls. Referral links populate the input through the `ref` URL parameter and the submitted code is passed to the protected registration flow.

## 2026-08-19 — Documentation and legal routes

Browser validation confirmed the local developer documentation presents the canonical production origin `https://kiwi-router.vercel.app/api/v1`, complete endpoint examples, and the Kiwi Credits, coupon, referral, and error sections. The responsive Privacy Policy route also rendered correctly with account-data, security, retention, and legal-policy navigation content.
