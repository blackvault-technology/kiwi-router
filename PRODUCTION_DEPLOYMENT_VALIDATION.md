# Production deployment validation

## 2026-08-19 checkpoint revision

The Vercel project reported a **READY** production deployment for the GitHub `main` revision `217bbe12b6c9e928a85dbe5a31bdc2b31cded4f7`, which contains the responsive coupon and referral interfaces, founder coupon controls, canonical API documentation, and legal pages.

| Item | Value |
|---|---|
| Vercel project | `kiwi-router` (`prj_7xpYuH0fJ0AmC2PHCpNZePgu3oVI`) |
| Deployment ID | `dpl_8ThiWR72Hx6KESq4UhP9bXVx289m` |
| Deployment status | `READY` |
| Target | Production |
| Deployment URL | `https://kiwi-router-4lwa8rbd4-webcrafterreal-9806s-projects.vercel.app` |
| Canonical URL | `https://kiwi-router.vercel.app/` |
| Source repository | `https://github.com/blackvault-technology/kiwi-router` |

## Responsive production check

A headless Chromium capture of the canonical production URL at **375 × 812 px** confirmed the mobile navigation trigger, CloudHug badge, Kiwi Router hero, readable body copy, and full-width primary and secondary calls to action render without horizontal clipping. Desktop browser validation also confirmed the provider rail exposes the intended OpenAI, Anthropic, Google AI, Mistral, Groq, Cohere, and DeepSeek marks.

An expanded **375 × 1800 px** production capture directly shows the rendered provider-rail heading and readable OpenAI and Anthropic marks immediately below the mobile gateway panel. The horizontally animated rail continues from that entry point, confirming the live mobile page contains the provider rail rather than only the hero shell.

## 2026-08-19 API status release

The checkpoint `990129ea50665fbca95c22a73cb57c15710496b4` deployed as Vercel production deployment `dpl_DUDLGYacGNgf5uNgctcmJzWMKWwC` with state **READY**. The canonical `https://kiwi-router.vercel.app/api/status` endpoint returned HTTP 200 JSON with real live component checks: operational Neon database and gateway signals, plus degraded zero-count signals for the currently unconfigured enabled model catalog and provider configuration. The public `https://kiwi-router.vercel.app/status` page rendered the same snapshot, checked timestamps, latency, refresh interaction, and safe degraded-state language.
