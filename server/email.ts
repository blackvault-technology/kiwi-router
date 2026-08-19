import type { Request } from "express";

function appOrigin(req: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) throw new Error("APP_URL must be configured for email links");
  return `${req.protocol}://${host}`;
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendMail(input: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !process.env.RESEND_FROM_EMAIL) {
    console.warn("[Email] Transactional mail is not configured; delivery was skipped.");
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [input.to], subject: input.subject, html: input.html }) });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status})`);
  return true;
}

export async function sendVerificationEmail(req: Request, email: string, token: string) {
  const url = `${appOrigin(req)}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({ to: email, subject: "Verify your Cloudhug Kiwi Router email", html: `<p>Welcome to Cloudhug's Kiwi Router.</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 30 minutes.</p>` });
}

export async function sendPasswordResetEmail(req: Request, email: string, token: string) {
  const url = `${appOrigin(req)}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({ to: email, subject: "Reset your Cloudhug Kiwi Router password", html: `<p>A password reset was requested for your account.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 20 minutes. If you did not request it, you can ignore this email.</p>` });
}
