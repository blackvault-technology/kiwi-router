import { AlertTriangle, CheckCircle2, CircleDotDashed, Clock3, Database, ExternalLink, Gauge, RefreshCw, ServerCog, WifiOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

type StatusLevel = "operational" | "degraded";
type StatusComponent = { id: string; name: string; status: StatusLevel; latencyMs: number; detail: string };
type Snapshot = { status: StatusLevel; service: string; checkedAt: string; components: StatusComponent[] };

const labels: Record<string, typeof Database> = { database: Database, gateway: ServerCog, models: Gauge, providers: CircleDotDashed };
const apiOrigin = "https://kiwi-router.vercel.app";

export function normalizeStatus(payload: unknown): Snapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Partial<Snapshot>;
  if ((data.status !== "operational" && data.status !== "degraded") || !Array.isArray(data.components) || typeof data.checkedAt !== "string") return null;
  const components = data.components.filter((component): component is StatusComponent => Boolean(component) && typeof component.id === "string" && typeof component.name === "string" && (component.status === "operational" || component.status === "degraded") && Number.isFinite(Number(component.latencyMs)) && typeof component.detail === "string");
  return { status: data.status, service: typeof data.service === "string" ? data.service : "cloudhug-kiwi-router", checkedAt: data.checkedAt, components };
}

export function StatusPage({ initialSnapshot, initialError = false }: { initialSnapshot?: Snapshot | null; initialError?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot ?? null);
  const [loading, setLoading] = useState(!initialSnapshot && !initialError);
  const [error, setError] = useState(initialError);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/status", { cache: "no-store", headers: { Accept: "application/json" } });
      const next = normalizeStatus(await response.json().catch(() => null));
      if (!response.ok || !next) throw new Error("Invalid status response");
      setSnapshot(next); setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); const interval = window.setInterval(() => void refresh(), 30_000); return () => window.clearInterval(interval); }, [refresh]);

  const operational = snapshot?.status === "operational";
  return <div className="min-h-screen bg-[#090b09] text-zinc-100"><header className="border-b border-white/[.07] bg-[#090b09]/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-7"><Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white"><span className="grid size-7 place-items-center rounded-lg bg-[#a5f763] font-mono text-xs font-black text-[#0a0c09]">K</span> Kiwi Router</Link><div className="flex gap-4 text-sm"><Link href="/docs" className="text-zinc-400 hover:text-white">Docs</Link><a href="/api/status" className="text-[#b5ff77] hover:text-[#d7ffb4]">Status API</a></div></div></header><main className="mx-auto max-w-5xl px-5 py-12 sm:px-7 sm:py-16"><section className="rounded-3xl border border-white/[.08] bg-[#101312] p-6 shadow-2xl shadow-black/20 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b5ff77]">CloudHug · live system status</p><div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Kiwi Router status</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">Live, low-cost health signals for the request gateway, Neon data layer, enabled model catalog, and provider configuration.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[.08] disabled:opacity-60"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Refresh</button></div><div className={`mt-8 flex items-center gap-3 rounded-2xl border p-4 ${operational ? "border-[#a5f763]/25 bg-[#a5f763]/[.06]" : "border-amber-300/20 bg-amber-300/[.06]"}`}>{operational ? <CheckCircle2 className="size-5 shrink-0 text-[#b5ff77]" /> : <AlertTriangle className="size-5 shrink-0 text-amber-200" />}<div><p className="font-medium text-zinc-100">{loading && !snapshot ? "Checking components…" : operational ? "All monitored systems operational" : "One or more monitored systems need attention"}</p><p className="mt-1 text-xs text-zinc-500">{snapshot ? `Last checked ${new Date(snapshot.checkedAt).toLocaleString()}` : error ? "The status endpoint could not be reached. Try again shortly." : "Status refreshes automatically every 30 seconds."}</p></div></div></section><section className="mt-6 grid gap-4 sm:grid-cols-2">{snapshot?.components.map(component => { const Icon = labels[component.id] ?? CircleDotDashed; const ok = component.status === "operational"; return <article key={component.id} className="rounded-2xl border border-white/[.08] bg-[#101312] p-5"><div className="flex items-start justify-between gap-4"><span className={`grid size-10 place-items-center rounded-xl ${ok ? "bg-[#a5f763]/10" : "bg-amber-300/10"}`}><Icon className={ok ? "size-5 text-[#b5ff77]" : "size-5 text-amber-200"} /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${ok ? "bg-[#a5f763]/10 text-[#b5ff77]" : "bg-amber-300/10 text-amber-200"}`}>{component.status}</span></div><h2 className="mt-5 font-semibold text-zinc-100">{component.name}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{component.detail}</p><div className="mt-5 flex items-center gap-2 border-t border-white/[.07] pt-4 text-xs text-zinc-600"><Clock3 className="size-3.5" /> Checked in {Math.max(0, Math.round(component.latencyMs))} ms</div></article>; })}</section>{!loading && !snapshot && <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-5"><div className="flex gap-3"><WifiOff className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold text-zinc-100">Status data is temporarily unavailable</h2><p className="mt-2 text-sm leading-6 text-zinc-500">This page does not guess component health. Use Refresh to request a new real-time snapshot from <code className="text-zinc-300">/api/status</code>.</p></div></div></section>}<section className="mt-10 rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-semibold text-zinc-100">Status API</h2><p className="mt-2 text-sm leading-6 text-zinc-500">The public JSON contract is cache-disabled and does not expose provider credentials, provider URLs, account data, or raw error details.</p><a href={`${apiOrigin}/api/status`} className="mt-4 inline-flex items-center gap-2 text-sm text-[#b5ff77] hover:text-[#d7ffb4]">{apiOrigin}/api/status <ExternalLink className="size-3.5" /></a></section></main></div>;
}
