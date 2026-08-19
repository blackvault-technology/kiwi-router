import { ChevronLeft, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type PolicyKind = "terms" | "privacy" | "acceptable-use" | "cookies";

const content: Record<PolicyKind, { eyebrow: string; title: string; summary: string; sections: { title: string; body: string[] }[] }> = {
  terms: {
    eyebrow: "Legal · Terms of Service",
    title: "Terms for using Kiwi Router",
    summary: "These terms govern use of CloudHug’s Kiwi Router, a Blackvault Technology and Cloud Hug by Blackvault product.",
    sections: [
      { title: "Service and account access", body: ["Kiwi Router provides developer tooling for managing configured AI-provider routes through an OpenAI-compatible interface. You must provide accurate account information, complete email verification, and protect your account, session, and API keys.", "You are responsible for activity performed through your account and keys. Do not share raw keys, circumvent account controls, or use another person’s account without authorization."] },
      { title: "Credits, payments, and availability", body: ["Kiwi Credits are measured service access units. Purchased credits and stipend credits may follow different expiry rules shown in the product. Credit balances do not guarantee uninterrupted upstream-provider availability or a particular response quality.", "Where Stripe Checkout is made available, payment processing is provided by the payment processor. Taxes, bank charges, and payment disputes are governed by the applicable payment method and processor terms."] },
      { title: "Acceptable use and suspension", body: ["You must follow the Acceptable Use Policy and all applicable laws. We may restrict, suspend, revoke keys, or close access when we reasonably identify abuse, security risk, fraudulent activity, rate-limit evasion, or material breach of these terms."] },
      { title: "Changes and contact", body: ["The service and these terms may change as the product evolves. Material changes are effective when posted here or communicated through the product. If you do not agree to a change, stop using the service."] },
    ],
  },
  privacy: {
    eyebrow: "Legal · Privacy Policy",
    title: "How Kiwi Router handles data",
    summary: "This policy explains the operational data CloudHug’s Kiwi Router processes to provide account security, API routing, and usage administration.",
    sections: [
      { title: "Information processed", body: ["Account data includes your name, email address, password-derived credential hash, verification and session state. Operational records can include API-key identifiers, model route, token totals, latency, error category, and security event metadata.", "For security controls, the service may process IP address information and a derived user-agent signal. Provider credentials are encrypted before storage. Raw API keys are displayed once when created and are stored as hashes."] },
      { title: "How information is used", body: ["Information is used to authenticate users, prevent abuse, route requests, account for Kiwi Credits, administer support and security controls, and improve service reliability. We do not use account telemetry to advertise to you.", "Gateway request logs are designed for metadata-only observability. Do not submit personal, confidential, regulated, or sensitive information to an upstream model unless you have assessed that provider and your intended use." ] },
      { title: "Sharing and retention", body: ["AI request content is sent to the configured upstream provider needed to fulfill your request. Payment details are handled by the selected payment processor. We may disclose information when required by law or to protect the service, users, and security of the platform.", "Data is retained for as long as reasonably necessary for the purposes described here, including security, accounting, dispute resolution, and legal compliance."] },
      { title: "Choices and requests", body: ["You can manage API keys and account access through the product. Requests concerning personal information should be submitted through the account support channel with enough information to verify the request."] },
    ],
  },
  "acceptable-use": {
    eyebrow: "Legal · Acceptable Use",
    title: "Use the gateway responsibly",
    summary: "Kiwi Router is built for legitimate, authorized development and production workloads. The following restrictions protect users, providers, and the shared service.",
    sections: [
      { title: "Prohibited activity", body: ["Do not use the service to violate law, infringe rights, distribute malware, compromise systems, conduct fraud, evade sanctions, generate or distribute exploit instructions, or perform unauthorized surveillance or credential collection.", "Do not bypass authentication, referral, coupon, payment, rate-limit, ban, or API-key controls. Do not create accounts or route traffic to manipulate promotional benefits, interfere with other users, or obscure abusive activity."] },
      { title: "Provider and content obligations", body: ["You are responsible for ensuring that your prompts, outputs, data sources, and downstream uses comply with the terms and policies of each configured AI provider. You must obtain the rights and permissions needed for information you submit."] },
      { title: "Enforcement", body: ["We may investigate suspected violations and use technical controls including logging, rate limiting, key revocation, and account restriction. Serious or repeated violations may lead to permanent removal of access or referral to appropriate authorities where required."] },
    ],
  },
  cookies: {
    eyebrow: "Legal · Cookie Policy",
    title: "Essential session cookies only",
    summary: "Kiwi Router uses essential cookies to maintain a signed-in session and secure browser-based account access.",
    sections: [
      { title: "Essential authentication cookie", body: ["The service uses a secure, HTTP-only session cookie named `kiwi_session` after sign-in. It is used to keep the authenticated browser session active and is not available to page JavaScript.", "The cookie uses a same-site setting intended to reduce cross-site request risk and is marked secure in production. Ending the session clears the cookie from the browser."] },
      { title: "Choices", body: ["You can block or remove cookies through browser settings. Doing so may prevent authentication and dashboard features from functioning. The product does not require an advertising-cookie consent flow for its essential session operation."] },
    ],
  },
};

function LegalPage({ kind }: { kind: PolicyKind }) {
  const policy = content[kind];
  return <div className="min-h-screen bg-[#090b09] text-zinc-100"><header className="border-b border-white/[.07] bg-[#090b09]/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-7"><Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"><ChevronLeft className="size-4" /> Kiwi Router</Link><Link href="/docs" className="text-sm text-[#b5ff77] hover:text-[#d7ffb4]">Developer docs</Link></div></header><main className="mx-auto max-w-4xl px-5 py-14 sm:px-7 sm:py-20"><div className="rounded-3xl border border-[#a5f763]/15 bg-[#a5f763]/[.04] p-6 sm:p-9"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#a5f763]/10"><FileText className="size-5 text-[#b5ff77]" /></span><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b5ff77]">{policy.eyebrow}</p></div><h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{policy.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">{policy.summary}</p><p className="mt-5 text-xs text-zinc-600">Last updated: August 19, 2026</p></div><article className="mt-12 space-y-10">{policy.sections.map(section => <section key={section.title}><h2 className="text-xl font-semibold text-zinc-100">{section.title}</h2>{section.body.map(paragraph => <p key={paragraph} className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">{paragraph}</p>)}</section>)}</article><div className="mt-14 flex items-start gap-3 rounded-2xl border border-white/[.08] bg-[#101312] p-5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#b5ff77]" /><p className="text-sm leading-6 text-zinc-400">This policy page is part of the product experience and should be reviewed with qualified legal counsel for the jurisdictions and customer commitments applicable to your deployment.</p></div></main><footer className="border-t border-white/[.07] py-8"><nav className="mx-auto flex max-w-4xl flex-wrap gap-x-5 gap-y-3 px-5 text-sm text-zinc-500 sm:px-7"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/cookies">Cookies</Link></nav></footer></div>;
}

export const TermsPage = () => <LegalPage kind="terms" />;
export const PrivacyPage = () => <LegalPage kind="privacy" />;
export const AcceptableUsePage = () => <LegalPage kind="acceptable-use" />;
export const CookiePolicyPage = () => <LegalPage kind="cookies" />;
