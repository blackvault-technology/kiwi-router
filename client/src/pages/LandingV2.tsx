import { ArrowRight, BookOpen, CheckCircle2, Cloud, Code2, Github, KeyRound, Menu, ShieldCheck, Sparkles, TerminalSquare, X, Zap } from "lucide-react";
import SiAnthropic from "@icons-pack/react-simple-icons/icons/SiAnthropic";
import SiDeepseek from "@icons-pack/react-simple-icons/icons/SiDeepseek";
import SiGoogle from "@icons-pack/react-simple-icons/icons/SiGoogle";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function OpenAiMark() {
  return <svg aria-hidden="true" className="size-5" fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24"><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" /></svg>;
}

function MistralMark() {
  return <svg aria-hidden="true" className="size-5" fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24"><path clipRule="evenodd" d="M3.428 3.4h3.429v3.428h3.429v3.429h-.002 3.431V6.828h3.427V3.4h3.43v13.714H24v3.429H13.714v-3.428h-3.428v-3.429h-3.43v3.428h3.43v3.429H0v-3.429h3.428V3.4zm10.286 13.715h3.428v-3.429h-3.427v3.429z" /></svg>;
}

function GroqMark() {
  return <svg aria-hidden="true" className="size-5" fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24"><path d="M12.036 2c-3.853-.035-7 3-7.036 6.781-.035 3.782 3.055 6.872 6.908 6.907h2.42v-2.566h-2.292c-2.407.028-4.38-1.866-4.408-4.23-.029-2.362 1.901-4.298 4.308-4.326h.1c2.407 0 4.358 1.915 4.365 4.278v6.305c0 2.342-1.944 4.25-4.323 4.279a4.375 4.375 0 01-3.033-1.252l-1.851 1.818A7 7 0 0012.029 22h.092c3.803-.056 6.858-3.083 6.879-6.816v-6.5C18.907 4.963 15.817 2 12.036 2z" /></svg>;
}

function CohereMark() {
  return <svg aria-hidden="true" className="size-5" fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24"><path clipRule="evenodd" d="M8.128 14.099c.592 0 1.77-.033 3.398-.703 1.897-.781 5.672-2.2 8.395-3.656 1.905-1.018 2.74-2.366 2.74-4.18A4.56 4.56 0 0018.1 1H7.549A6.55 6.55 0 001 7.55c0 3.617 2.745 6.549 7.128 6.549z" /><path clipRule="evenodd" d="M9.912 18.61a4.387 4.387 0 012.705-4.052l3.323-1.38c3.361-1.394 7.06 1.076 7.06 4.715a5.104 5.104 0 01-5.105 5.104l-3.597-.001a4.386 4.386 0 01-4.386-4.387z" /><path d="M4.776 14.962A3.775 3.775 0 001 18.738v.489a3.776 3.776 0 007.551 0v-.49a3.775 3.775 0 00-3.775-3.775z" /></svg>;
}

const providers = [
  { name: "OpenAI", mark: <OpenAiMark />, accent: "text-zinc-100" },
  { name: "Anthropic", mark: <SiAnthropic className="size-5" color="#e8e1d6" />, accent: "text-[#e8e1d6]" },
  { name: "Google AI", mark: <SiGoogle className="size-5" color="#8ab4f8" />, accent: "text-[#8ab4f8]" },
  { name: "Mistral", mark: <MistralMark />, accent: "text-[#ff9b57]" },
  { name: "Groq", mark: <GroqMark />, accent: "text-[#f4c58a]" },
  { name: "Cohere", mark: <CohereMark />, accent: "text-[#a8a5ff]" },
  { name: "DeepSeek", mark: <SiDeepseek className="size-5" color="#719cff" />, accent: "text-[#719cff]" },
];

function Wordmark() {
  return <Link href="/" className="group inline-flex items-center gap-3" aria-label="Kiwi Router home">
    <span className="grid size-9 place-items-center rounded-xl bg-[#a5f763] font-mono text-base font-black text-[#0a0c09] shadow-[0_0_24px_rgba(165,247,99,0.24)] transition-transform duration-200 group-hover:scale-105">K</span>
    <span className="leading-none"><span className="block text-sm font-semibold tracking-tight text-white">Kiwi Router</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">CloudHug platform</span></span>
  </Link>;
}

function PublicNav() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090b09]/80 backdrop-blur-xl">
    <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-7">
      <Wordmark />
      <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
        <a href="#platform" className="transition-colors hover:text-white">Platform</a>
        <Link href="/docs" className="transition-colors hover:text-white">Developers</Link>
        <Link href="/about" className="transition-colors hover:text-white">About</Link>
        <a href="https://github.com/blackvault-technology/kiwi-router" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition-colors hover:text-white"><Github className="size-4" /> GitHub</a>
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <Link href="/login"><Button variant="ghost" className="text-zinc-300 hover:bg-white/[.06] hover:text-white">Sign in</Button></Link>
        <Link href="/register"><Button className="bg-[#a5f763] text-[#0a0c09] shadow-[0_0_30px_rgba(165,247,99,.15)] hover:bg-[#c2ff8c]">Create account <ArrowRight className="size-4" /></Button></Link>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setOpen(value => !value)} className="md:hidden" aria-label="Toggle menu">{open ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
    </div>
    {open && <nav className="border-t border-white/[0.07] px-5 py-4 md:hidden"><div className="mx-auto grid max-w-7xl gap-1 text-sm text-zinc-300"><a href="#platform" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-white/[.05]">Platform</a><Link href="/docs" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-white/[.05]">Developers</Link><Link href="/about" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-white/[.05]">About</Link><Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-white/[.05]">Sign in</Link><Link href="/register" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-[#a5f763] px-3 py-2.5 font-medium text-[#0a0c09]">Create account</Link></div></nav>}
  </header>;
}

function HeroTerminal() {
  return <div className="gateway-glass p-1">
    <div className="relative rounded-[1.7rem] border border-white/[0.06] bg-[#0b0f0c]/90 p-5 sm:p-7">
      <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-400" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-[#a5f763]" /></div><span className="rounded-full border border-[#a5f763]/15 bg-[#a5f763]/[.07] px-2.5 py-1 font-mono text-[10px] text-[#c7ff98]">gateway-ready</span></div>
      <p className="font-mono text-xs text-zinc-500">POST <span className="text-sky-200">/api/v1/chat/completions</span></p>
      <div className="mt-5 space-y-2 rounded-2xl border border-white/[0.07] bg-black/25 p-4 font-mono text-[11px] leading-6 text-zinc-300 sm:text-xs"><p><span className="text-[#a5f763]">Authorization:</span> Bearer kiwi_sk_••••••••</p><p><span className="text-[#a5f763]">model:</span> kiwi/gpt-4o-mini</p><p><span className="text-[#a5f763]">stream:</span> true</p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Authentication" value="Key scoped" /><MiniStat label="Cost control" value="Credits" /><MiniStat label="Response" value="OpenAI shape" /></div>
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#a5f763]/15 bg-[#a5f763]/[.055] p-3"><span className="grid size-8 place-items-center rounded-xl bg-[#a5f763] text-[#0a0c09]"><Zap className="size-4" /></span><p className="text-xs leading-5 text-zinc-300">A single endpoint for configured providers, governed by your keys, limits, and Kiwi Credits.</p></div>
    </div>
  </div>;
}

function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[.12em] text-zinc-600">{label}</p><p className="mt-1.5 text-xs font-medium text-zinc-200">{value}</p></div>; }

function ProviderRail() {
  const rail = [...providers, ...providers];
  return <section className="border-y border-white/[0.07] bg-white/[.018] py-5"><div className="mx-auto grid max-w-7xl gap-4 px-5 sm:grid-cols-[190px_1fr] sm:items-center sm:px-7"><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-500">Bring your providers</p><div className="provider-rail overflow-hidden"><div className="provider-track flex items-center gap-3 pr-3">{rail.map((provider, index) => <div key={`${provider.name}-${index}`} className="flex h-11 min-w-37 items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#101312] px-5 text-sm font-semibold tracking-tight text-zinc-300 shadow-[0_8px_25px_rgba(0,0,0,.12)]"><span className={provider.accent}>{provider.mark}</span><span>{provider.name}</span></div>)}</div></div></div></section>;
}

function Capability({ icon: Icon, eyebrow, title, children }: { icon: React.ComponentType<{ className?: string }>; eyebrow: string; title: string; children: string }) {
  return <article className="group rounded-3xl border border-white/[0.08] bg-[#101312]/75 p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#a5f763]/20 hover:bg-[#131714]"><span className="grid size-10 place-items-center rounded-2xl border border-[#a5f763]/15 bg-[#a5f763]/[.08]"><Icon className="size-4 text-[#c7ff98]" /></span><p className="mt-7 text-[11px] font-semibold uppercase tracking-[.16em] text-[#a5f763]">{eyebrow}</p><h3 className="mt-2 text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{children}</p></article>;
}

function PublicFooter() {
  return <footer className="border-t border-white/[0.07] bg-[#080a08] py-10"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"><div><Wordmark /><p className="mt-5 max-w-md text-sm leading-6 text-zinc-500">CloudHug's Kiwi Router is a Blackvault Technology and Cloud Hug by Blackvault product.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-zinc-500"><Link href="/docs" className="hover:text-white">Docs</Link><Link href="/about" className="hover:text-white">About</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/acceptable-use" className="hover:text-white">Acceptable use</Link></nav></div></footer>;
}

export function LandingPage() {
  return <div className="min-h-screen overflow-x-hidden bg-[#090b09] text-zinc-100"><PublicNav /><main><section className="relative isolate overflow-hidden"><div className="hero-grid pointer-events-none absolute inset-0 -z-20 opacity-60" /><div className="absolute -left-40 top-0 -z-10 size-[35rem] rounded-full bg-[#a5f763]/[.08] blur-[120px]" /><div className="absolute right-0 top-28 -z-10 size-[26rem] rounded-full bg-sky-400/[.07] blur-[110px]" /><div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-7 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24"><div><span className="cloudhug-badge"><Cloud className="size-3.5 text-sky-200" /> CloudHug <span className="text-sky-200/50">/</span> secure AI gateway</span><h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">Route every model.<br /><span className="text-[#a5f763]">Keep every control.</span></h1><p className="mt-7 max-w-xl text-base leading-8 text-zinc-400 sm:text-lg">Kiwi Router gives teams one OpenAI-compatible API while keeping provider credentials encrypted, requests governed, and Kiwi Credits visible before a request leaves your gateway.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/register"><Button size="lg" className="h-12 w-full gap-2 bg-[#a5f763] px-5 text-[#0a0c09] shadow-[0_0_36px_rgba(165,247,99,.16)] hover:bg-[#c2ff8c] sm:w-auto">Start with Kiwi Router <ArrowRight className="size-4" /></Button></Link><Link href="/docs"><Button size="lg" variant="outline" className="h-12 w-full border-white/[.12] bg-white/[.03] px-5 text-zinc-100 hover:bg-white/[.08] sm:w-auto"><BookOpen className="mr-2 size-4" /> Explore live docs</Button></Link></div><div className="mt-9 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3"><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#a5f763]" /> Verified accounts</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#a5f763]" /> OpenAI-compatible</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#a5f763]" /> Neon-backed audit trail</span></div></div><HeroTerminal /></div></section><ProviderRail /><section id="platform" className="mx-auto max-w-7xl px-5 py-20 sm:px-7 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#a5f763]">A control plane for AI traffic</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Developer speed, with the controls infrastructure needs.</h2><p className="mt-5 text-base leading-7 text-zinc-500">Every production surface is built around a simple idea: integrations should be easy to start, easy to inspect, and difficult to misuse.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3"><Capability icon={ShieldCheck} eyebrow="Secure by default" title="Protect the request path">Verified sign-in, scoped API keys, rate controls, and audit signals keep access deliberate.</Capability><Capability icon={KeyRound} eyebrow="Accountable spend" title="Credit-aware routing">Kiwi Credits are checked before routing so teams can see and control usage at the gateway.</Capability><Capability icon={Code2} eyebrow="Made for integration" title="Keep your existing SDK">Use the endpoints and request shape your OpenAI-compatible client already understands.</Capability></div></section><section className="border-t border-white/[0.07] bg-white/[.018]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#a5f763]">Ready to route</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">The next model call should be yours.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Create a verified workspace, generate a key once, and route through the canonical API endpoint.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/register"><Button className="h-11 bg-[#a5f763] text-[#0a0c09] hover:bg-[#c2ff8c]">Create account <ArrowRight className="size-4" /></Button></Link><Link href="/docs"><Button variant="outline" className="h-11 border-white/[.12] bg-transparent text-zinc-200 hover:bg-white/[.06]"><TerminalSquare className="mr-2 size-4" /> API reference</Button></Link></div></div></section></main><PublicFooter /></div>;
}
