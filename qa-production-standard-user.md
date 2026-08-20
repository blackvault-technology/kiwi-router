# Standard-user production QA notes

Date: 2026-08-20

## API Keys

The connected My Browser session is authenticated as a standard user (`Web Crafter`) with 294 Kiwi Credits and verified email status. The workspace shows no founder controls. The API Keys page renders the starter, API-key navigation, a user-owned key (`hi`, masked prefix and last four), and revoke action. The currently published production page still shows the older simple create-key form, not the new policy fields from checkpoint `d1563f1f`; that newer checkpoint must be published before live policy-field QA.

## Models

The production Models page renders the standard-user workspace with no founder controls, a collapsible starter, provider-neutral public model labels, Kiwi Auto Model (`kiwi/auto`) with SMART ROUTE badge, search, context windows, and credit cost. Multiple public Kiwi routes are visible. No provider names are exposed in the catalog.

## Analytics

The production Analytics page renders real Neon-backed usage data for Aug 19: 18 requests, 4.8K tokens, 540 ms, and 88.9% errors. It has safe empty/error-compatible structure and no founder controls.

## Playground

The production Playground renders Kiwi Auto Model as the default selection, provider-neutral model options, API-key password input, prompt editor, structured JSON and tool routing toggles, gateway test action, generated curl/JavaScript/Python/streaming examples, and no founder controls. No request was submitted because that would create real gateway usage and require confirmation. The published Playground is functional for inspection, but the current production release still exposes the older simple API-key creation form rather than the new policy fields.

## Overview / Credits / Coupons / Referrals

The production Overview rendered real account data: 294 Kiwi Credits, 18 requests, 4.8K routed tokens, and 88.9% error rate. Coupon redemption was present with one-per-account/network guidance. Referral data rendered with a real registration link and activated/pending/claimable counters. Credit packs rendered as Sprout, Grove, and Orchard with Stripe Checkout actions; no purchase or redemption mutation was submitted during QA.

## QA scope conclusion

The authenticated standard-user desktop pass covered Overview, API Keys, Models, Analytics, and Playground. Mobile-width local route captures were also requested for the workspace, API Keys, Playground, and Models; the sandbox capture is blank when no local auth session is present, so it is treated as structural responsive verification rather than an authenticated visual session. The production deployment currently predates checkpoint `d1563f1f`, so the new API-key policy fields require publication before live policy-field inspection.
