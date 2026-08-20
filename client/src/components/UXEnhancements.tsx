import { Command, KeyRound, MessageSquareText, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UX_ENHANCEMENTS } from "@/lib/uxEnhancementCatalog";

const shortcuts = [
  ["g then p", "Open Playground", "/app/playground"],
  ["g then m", "Open Models", "/app/models"],
  ["g then k", "Open API Keys", "/app/api-keys"],
  ["g then a", "Open Analytics", "/app/analytics"],
] as const;

export function UXEnhancements({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const [palette, setPalette] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeOption, setActiveOption] = useState(0);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const filteredShortcuts = useMemo(() => shortcuts.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    document.title = path === "/app/playground" ? "Playground · Kiwi Router" : path === "/app/models" ? "Models · Kiwi Router" : path === "/app/api-keys" ? "API Keys · Kiwi Router" : "Kiwi Router · CloudHug";
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    setAnnouncement(`Workspace changed to ${path.replace("/app", "").replaceAll("/", " ").trim() || "overview"}.`);
  }, [path, reducedMotion]);

  useEffect(() => {
    if (!palette) return;
    setQuery("");
    setActiveOption(0);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [palette]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(value => !value);
        return;
      }
      if (event.key === "Escape") {
        setPalette(false);
        setPending(false);
        return;
      }
      if (palette && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        setActiveOption(current => {
          const next = event.key === "ArrowDown" ? current + 1 : current - 1;
          return Math.max(0, Math.min(Math.max(filteredShortcuts.length - 1, 0), next));
        });
        return;
      }
      if (palette && event.key === "Enter" && filteredShortcuts[activeOption]) {
        event.preventDefault();
        const [, label, target] = filteredShortcuts[activeOption];
        setPalette(false);
        setAnnouncement(`${label} opened.`);
        onNavigate(target);
        return;
      }
      if (event.key.toLowerCase() === "g" && !palette) {
        setPending(true);
        window.setTimeout(() => setPending(false), 1200);
        return;
      }
      if (!pending || palette) return;
      const target = shortcuts.find(([key]) => key.endsWith(event.key.toLowerCase()));
      if (target) {
        event.preventDefault();
        onNavigate(target[2]);
        setAnnouncement(`${target[1]} opened.`);
        setPending(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeOption, filteredShortcuts, onNavigate, palette, pending]);

  const openTarget = (label: string, target: string) => {
    setPalette(false);
    setAnnouncement(`${label} opened.`);
    onNavigate(target);
  };

  return <div data-ux-enhancements={UX_ENHANCEMENTS.join(" ")}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-[#a5f763] focus:px-4 focus:py-2 focus:text-black">Skip to content</a>
    <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement || `Current workspace: ${path.replace("/app", "").replaceAll("/", " ") || "overview"}`}</div>
    <Button aria-label="Open command palette" title="Command palette (Ctrl/Cmd + K)" variant="ghost" size="icon" onClick={() => setPalette(true)} className="fixed bottom-4 right-4 z-30 hidden rounded-full border border-[#8ee53f]/20 bg-[#101510] text-[#b5ff77] shadow-xl sm:flex"><Command className="size-4" /></Button>
    <div className="mobile-action-bar fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#101112]/95 p-2 shadow-2xl backdrop-blur lg:hidden" aria-label="Mobile workspace actions"><button onClick={() => openTarget("Playground", "/app/playground")} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><MessageSquareText className="size-4" />Playground</button><button onClick={() => openTarget("API Keys", "/app/api-keys")} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><KeyRound className="size-4" />API Keys</button><button onClick={() => setPalette(true)} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><Command className="size-4" />More</button></div>
    {palette && <div className="fixed inset-0 z-[60] grid place-items-start bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setPalette(false)}><div role="dialog" aria-modal="true" aria-labelledby="kiwi-command-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101112] p-3 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-2 flex items-center justify-between px-2"><div><p id="kiwi-command-title" className="text-sm font-medium text-zinc-100">Quick navigation</p><p className="mt-1 text-xs text-zinc-500">Keyboard-first workspace controls</p></div><Button aria-label="Close command palette" variant="ghost" size="icon" onClick={() => setPalette(false)}><X className="size-4" /></Button></div><label className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="size-4 text-zinc-500" /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workspace" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none" aria-label="Search workspace commands" /></label><div role="listbox" aria-label="Workspace commands">{filteredShortcuts.length ? filteredShortcuts.map(([, label, target], index) => <button ref={node => { optionRefs.current[index] = node; }} role="option" aria-selected={activeOption === index} key={target} onMouseEnter={() => setActiveOption(index)} onClick={() => openTarget(label, target)} className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${activeOption === index ? "bg-[#8ee53f]/[.10] text-[#b5ff77]" : "text-zinc-300 hover:bg-[#8ee53f]/[.08] hover:text-[#b5ff77]"}`}><span>{label}</span><kbd className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-600">{shortcuts.find(item => item[2] === target)?.[0]}</kbd></button>) : <p className="p-4 text-sm text-zinc-500">No workspace command matches that search.</p>}</div></div></div>}
  </div>;
}
