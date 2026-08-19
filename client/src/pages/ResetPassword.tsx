import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";

export default function ResetPassword() {
  const [, setLocation] = useLocation(); const search = useSearch(); const token = new URLSearchParams(search).get("token") || ""; const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => setLocation("/?reset=success") });
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return; reset.mutate({ token, password }); };
  return <main className="grid min-h-screen place-items-center bg-[#090a09] p-5 text-zinc-100"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/8 bg-[#101112] p-8"><span className="grid size-12 place-items-center rounded-2xl bg-[#8ee53f]/12"><LockKeyhole className="size-6 text-[#a5f763]" /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-[#a5f763]">Account recovery</p><h1 className="mt-2 text-2xl font-semibold">Choose a new password</h1><p className="mt-2 text-sm text-zinc-500">Resetting your password signs out all other sessions.</p><div className="mt-6 space-y-4"><div className="space-y-2"><Label>New password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters" className="bg-black/25" /></div><div className="space-y-2"><Label>Confirm password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="bg-black/25" /></div>{reset.error && <p className="text-sm text-rose-300">{reset.error.message}</p>}<Button disabled={!token || password.length < 10 || password !== confirm || reset.isPending} className="w-full bg-[#8ee53f] text-black hover:bg-[#a5f763]">Set new password</Button></div></form></main>;
}
