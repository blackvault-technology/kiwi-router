import { Activity, ArrowLeft, Bot, CheckCircle2, ChevronRight, Command, DatabaseZap, KeyRound, LayoutDashboard, LogOut, Moon, Radio, Search, ShieldCheck, Sun, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FounderControlCenter } from "@/components/FounderControlCenter";
import { UXEnhancements } from "@/components/UXEnhancements";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type SessionUser = { id: number; name: string; email: string; role: "user" | "admin" | "founder"; kiwiCredits: number };
type AdminSection = "operations" | "providers" | "models" | "access" | "growth";

type NavItem = { id: AdminSection; label: string; shortLabel: string; detail: string; icon: typeof Activity; keywords: string };

const navItems: NavItem[] = [
  { id: "operations", label: "Command center", shortLabel: "Home", detail: "System health, gateway state, and next actions", icon: LayoutDashboard, keywords: "home overview health gateway status" },
  { id: "providers", label: "Providers & keys", shortLabel: "Providers", detail: "Connections, credentials, discovery, and health", icon: Radio, keywords: "providers credentials keys connections sync" },
  { id: "models", label: "Models & routes", shortLabel: "Models", detail: "Public identities, routes, policies, and tests", icon: Bot, keywords: "models routes identities auto policy test" },
  { id: "access", label: "Users & safety", shortLabel: "Safety", detail: "Accounts, limits, bans, diagnostics, and audit", icon: ShieldCheck, keywords: "users access safety limits bans audit" },
  { id: "growth", label: "Credits & growth", shortLabel: "Growth", detail: "Credits, coupons, referrals, and announcements", icon: UsersRound, keywords: "credits coupons referrals announcements growth" },
];

const asArray = <T,>(value: unknown) => Array.isArray(value) ? value as T[] : [];
const compact = (value: unknown) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

function AdminSkeleton() {
  return <div aria-label="Loading admin control center" className="space-y-4" role="status"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/[.035]" />)}</div><div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]"><div className="h-52 animate-pulse rounded-2xl border border-white/8 bg-white/[.035]" /><div className="h-52 animate-pulse rounded-2xl border border-white/8 bg-white/[.035]" /></div><span className="sr-only">Loading founder admin data</span></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{value}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>;
}

export function FounderOperationsApp({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<AdminSection>("operations");
  const [search, setSearch] = useState("");
  const [opsTheme, setOpsTheme] = useState<"dark" | "light">(() => (localStorage.getItem("kiwi-ops-theme") as "dark" | "light" | null) ?? "dark");
  const [loading, setLoading] = useState(true);
  const logout = trpc.auth.logout.useMutation({ onSuccess: onLogout });
  const providers = trpc.admin.providers.useQuery();
  const models = trpc.admin.models.useQuery();
  const users = trpc.admin.users.useQuery();
  const limits = trpc.admin.rateLimits.useQuery();
  const economy = trpc.admin.economy.useQuery();
  const filteredNav = useMemo(() => { const query = search.trim().toLowerCase(); return query ? navItems.filter(item => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(query)) : navItems; }, [search]);
  const providerRows = asArray<{ isEnabled: boolean; isHealthy: boolean }>(providers.data);
  const modelRows = asArray<{ model: { isEnabled: boolean } }>(models.data);
  const userRows = asArray<unknown>(users.data);
  const active = navItems.find(item => item.id === section) ?? navItems[0];

  useEffect(() => { localStorage.setItem("kiwi-ops-theme", opsTheme); }, [opsTheme]);
  useEffect(() => { setLoading(true); const timer = window.setTimeout(() => setLoading(false), 260); return () => window.clearTimeout(timer); }, [section]);

  if (user.role !== "founder") return <div className="grid min-h-screen place-items-center bg-[#080908] p-6 text-zinc-100"><div className="w-full max-w-md rounded-3xl border border-rose-300/15 bg-[#101211] p-7 text-center"><ShieldCheck className="mx-auto size-8 text-rose-300" /><h1 className="mt-4 text-xl font-semibold">Founder access required</h1><p className="mt-2 text-sm text-zinc-500">This operations application is isolated from the user workspace and is available only to the founder role.</p><Button className="mt-6" onClick={() => setLocation("/app")}>Return to workspace</Button></div></div>;

  return <div className={`ops-shell min-h-screen ${opsTheme === "light" ? "ops-theme-light" : "bg-[#080908] text-zinc-100"}`} data-ops-theme={opsTheme}>
    <UXEnhancements path="/ops" onNavigate={setLocation} />
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080908]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#8ee53f] text-black shadow-[0_0_28px_rgba(142,229,63,.18)]"><DatabaseZap className="size-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">Kiwi Router Admin</span><span className="rounded-full border border-sky-300/20 bg-sky-300/[.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.14em] text-sky-100">CloudHug Ops</span></div><p className="hidden text-[11px] text-zinc-600 sm:block">Founder control plane · real Neon data</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setLocation("/app")} className="hidden border-white/10 sm:inline-flex"><ArrowLeft className="mr-1.5 size-3.5" />Workspace</Button><Button variant="ghost" size="icon" aria-label={opsTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setOpsTheme(value => value === "dark" ? "light" : "dark")}>{opsTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button><Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => logout.mutate()}><LogOut className="size-4" /></Button></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1680px] gap-0 lg:grid-cols-[272px_1fr]">
      <aside className="border-b border-white/8 bg-[#0b0c0b] p-3 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:p-4">
        <div className="mb-4 rounded-2xl border border-[#8ee53f]/15 bg-[#8ee53f]/[.05] p-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#a5f763]"><CheckCircle2 className="size-3.5" />Control plane ready</div><p className="mt-2 text-xs leading-5 text-zinc-400">Use one section at a time. Every change is audited and safe retirement preserves history.</p></div>
        <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-3 size-3.5 text-zinc-600" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search admin" aria-label="Search admin sections" className="h-9 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8ee53f]/50 focus:ring-2 focus:ring-[#8ee53f]/10" /></div>
        <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1" aria-label="Founder admin sections"><p className="col-span-full mb-1 hidden px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600 lg:block">Manage</p>{filteredNav.map(item => { const Icon = item.icon; const selected = item.id === section; return <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={selected ? "page" : undefined} className={`group flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left transition ${selected ? "bg-[#8ee53f]/10 text-[#b5ff77]" : "text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200"}`}><Icon className="size-4 shrink-0" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{item.shortLabel}</span><span className="hidden truncate text-[10px] text-zinc-600 lg:block">{item.label}</span></span><ChevronRight className={`ml-auto hidden size-3 lg:block ${selected ? "text-[#a5f763]" : "text-zinc-700"}`} /></button>; })}</nav>{filteredNav.length === 0 && <p className="mt-2 rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-600">No admin section matches.</p>}
        <div className="mt-6 hidden rounded-2xl border border-white/8 bg-black/15 p-3 lg:block"><div className="flex items-center gap-2 text-xs text-zinc-400"><KeyRound className="size-3.5 text-[#a5f763]" />Founder session</div><p className="mt-2 truncate text-sm text-zinc-200">{user.name}</p><p className="mt-1 truncate text-[11px] text-zinc-600">{user.email}</p></div>
      </aside>
      <main id="main-content" className="min-w-0 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#a5f763]"><Command className="size-3.5" />Admin / {active.shortLabel}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{active.label}</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">{active.detail}. Changes flow through the authenticated Neon control plane.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] px-3 py-2 text-xs text-zinc-500"><span className="size-2 rounded-full bg-[#8ee53f] shadow-[0_0_10px_rgba(142,229,63,.9)]" />Neon connected</div></div>
        {section === "operations" && <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Providers" value={String(providerRows.length)} detail={`${providerRows.filter(row => row.isEnabled).length} enabled · ${providerRows.filter(row => row.isHealthy).length} healthy`} /><Metric label="Model routes" value={String(modelRows.length)} detail={`${modelRows.filter(row => row.model.isEnabled).length} live for routing`} /><Metric label="Users" value={compact(userRows.length)} detail="Accounts in the control plane" /><Metric label="Gateway" value={limits.data?.globalApiEnabled ? "Live" : "Paused"} detail={`${compact(economy.data?.circulating)} credits in circulation`} /></div>}
        {loading ? <AdminSkeleton /> : <FounderControlCenter key={section} initialSection={section} />}
      </div></main>
    </div>
  </div>;
}
