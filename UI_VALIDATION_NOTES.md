# UI validation notes

## 2026-08-19 — CloudHug landing rail

The local Kiwi Router landing page rendered successfully in a browser after replacing the oversized provider-icon dependency. The page presents the compact CloudHug badge, Kiwi Router wordmark, gateway endpoint panel, and animated rail for OpenAI, Anthropic, Google AI, Mistral, Groq, Cohere, and DeepSeek without a visible client error.

OpenAI, Mistral, Groq, and Cohere now use individual vector paths sourced from the MIT-licensed [Lobe Icons repository](https://github.com/lobehub/lobe-icons), while Anthropic, Google, and DeepSeek use the already-installed lightweight Simple Icons React components. The production build succeeded after the oversized package was removed.
