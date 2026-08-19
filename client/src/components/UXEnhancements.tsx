import { Command, KeyRound, MessageSquareText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const shortcuts = [
  ["g then p", "Open Playground", "/app/playground"],
  ["g then m", "Open Models", "/app/models"],
  ["g then k", "Open API Keys", "/app/api-keys"],
  ["g then a", "Open Analytics", "/app/analytics"],
] as const;

export function UXEnhancements({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const [palette, setPalette] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    document.title = path === "/app/playground" ? "Playground · Kiwi Router" : path === "/app/models" ? "Models · Kiwi Router" : "Kiwi Router · CloudHug";
    window.scrollTo({ top: 0, behavior: "smooth" });
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(value => !value); return; }
      if (event.key === "Escape") { setPalette(false); setPending(false); return; }
      if (event.key.toLowerCase() === "g") { setPending(true); window.setTimeout(() => setPending(false), 1200); return; }
      if (!pending) return;
      const target = shortcuts.find(([key]) => key.endsWith(event.key.toLowerCase()));
      if (target) { event.preventDefault(); onNavigate(target[2]); setPending(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate, path, pending]);
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-[#a5f763] focus:px-4 focus:py-2 focus:text-black">Skip to content</a>
    <div aria-live="polite" className="sr-only">Current workspace: {path.replace("/app", "").replaceAll("/", " ") || "overview"}</div>
    <Button aria-label="Open command palette" title="Command palette (Ctrl/Cmd + K)" variant="ghost" size="icon" onClick={() => setPalette(true)} className="fixed bottom-4 right-4 z-30 hidden rounded-full border border-[#8ee53f]/20 bg-[#101510] text-[#b5ff77] shadow-xl sm:flex"><Command className="size-4" /></Button>
    <div className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#101112]/95 p-2 shadow-2xl backdrop-blur lg:hidden"><button onClick={() => onNavigate("/app/playground")} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><MessageSquareText className="size-4" />Playground</button><button onClick={() => onNavigate("/app/api-keys")} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><KeyRound className="size-4" />API Keys</button><button onClick={() => setPalette(true)} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-zinc-400 hover:bg-white/5 hover:text-[#b5ff77]"><Command className="size-4" />More</button></div>
    {palette && <div className="fixed inset-0 z-[60] grid place-items-start bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setPalette(false)}><div role="dialog" aria-modal="true" aria-label="Kiwi Router command palette" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101112] p-3 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-2 flex items-center justify-between px-2"><div><p className="text-sm font-medium text-zinc-100">Quick navigation</p><p className="mt-1 text-xs text-zinc-500">Keyboard-first workspace controls</p></div><Button variant="ghost" size="icon" onClick={() => setPalette(false)}><X className="size-4" /></Button></div>{shortcuts.map(([, label, target]) => <button key={target} onClick={() => { setPalette(false); onNavigate(target); }} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-zinc-300 hover:bg-[#8ee53f]/[.08] hover:text-[#b5ff77]"><span>{label}</span><kbd className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-600">{shortcuts.find(item => item[2] === target)?.[0]}</kbd></button>)}</div></div>}
  </>;
}
