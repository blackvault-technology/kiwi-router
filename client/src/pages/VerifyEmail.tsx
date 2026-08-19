import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

export default function VerifyEmail() {
  const [, setLocation] = useLocation(); const search = useSearch(); const utils = trpc.useUtils(); const ran = useRef(false);
  const token = new URLSearchParams(search).get("token") || "";
  const verify = trpc.auth.verifyEmail.useMutation({ onSuccess: user => { utils.auth.me.setData(undefined, user); setLocation("/"); } });
  useEffect(() => { if (!ran.current && token) { ran.current = true; verify.mutate({ token }); } }, [token]);
  return <main className="grid min-h-screen place-items-center bg-[#090a09] p-5 text-zinc-100"><div className="w-full max-w-md rounded-3xl border border-white/8 bg-[#101112] p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#8ee53f]/12"><ShieldCheck className="size-6 text-[#a5f763]" /></span><h1 className="mt-5 text-2xl font-semibold">Verifying your email</h1>{!token ? <><p className="mt-3 text-sm leading-6 text-zinc-500">This verification link is incomplete. Request a new email from the sign-in page.</p><Button onClick={() => setLocation("/")} className="mt-6 bg-[#8ee53f] text-black">Back to sign in</Button></> : verify.isPending ? <div className="mt-5 flex justify-center"><Loader2 className="size-5 animate-spin text-[#a5f763]" /></div> : verify.error ? <><p className="mt-3 text-sm leading-6 text-rose-300">{verify.error.message}</p><Button onClick={() => setLocation("/")} className="mt-6 bg-[#8ee53f] text-black">Back to sign in</Button></> : <p className="mt-3 text-sm text-zinc-500">Your account is verified. Redirecting securely…</p>}</div></main>;
}
