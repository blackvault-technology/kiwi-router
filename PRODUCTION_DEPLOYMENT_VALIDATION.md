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

The latest checkpoint `3d47a9cccd288bf5481ecbe68ca7f5fd772f1c2b` is active as Vercel production deployment `dpl_4m6w3aGPaEJ3VeQYnCN5cbg47wFE` with state **READY**. A cache-busting production request at 11:15 UTC returned HTTP 200 with `Cache-Control: no-store, max-age=0`; its fresh status timestamp confirmed the operational Neon database and gateway checks are live on the active release.

## 2026-08-19 Founder control-center release

The founder control-center checkpoint `cc3cd3371bf36a3e9c824e262b96170b58fd65b2` deployed as Vercel production deployment `dpl_AwynMHqz2tav9zzgxdKoCnZHnovt` with state **READY**. A fresh canonical status request at 11:50 UTC returned the expected operational Neon database and gateway signals. The enabled model catalog and provider configuration remain correctly reported as degraded until the founder connects provider credentials and enables reviewed model routes through the new console.

## 2026-08-19 Provider-sync hardening release

Checkpoint `48a700c5afd54fda3ed6a8e46c2b6439a270daf0` deployed as Vercel production deployment `dpl_6XTKDibZ1QcLQ3mk4rMx642yMKke` with state **READY** and alias `kiwi-router.vercel.app`. The live `/status` page loaded successfully. The cache-disabled `/api/status` endpoint returned a fresh JSON snapshot with operational Neon database, gateway, and provider configuration components; the model catalog correctly reported degraded with `0 enabled routes`. No credentials, provider URLs, account data, or raw upstream error details were present.

The founder-only sync mutation is covered locally by `server/provider-sync.contract.test.ts` and the full suite passes 64 tests. The exact interactive founder-session sync action remains a manual QA step because it requires the founder's authenticated browser session.
