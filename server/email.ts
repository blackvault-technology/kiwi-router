import type { Request } from "express";
import { createEmailOutbox } from "./db";

function appOrigin(req: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) throw new Error("APP_URL must be configured for email links");
  return `${req.protocol}://${host}`;
}

/** Neon is the source of truth. A separate worker or admin can process pending rows later. */
export function emailDeliveryConfigured() {
  return Boolean(process.env.NEON_DATABASE_URL);
}

async function queueMail(input: { userId?: number; to: string; purpose: "email_verify" | "password_reset"; subject: string; html: string }) {
  await createEmailOutbox(input);
  return true;
}

export async function sendVerificationEmail(req: Request, userId: number, email: string, token: string) {
  const url = `${appOrigin(req)}/verify-email?token=${encodeURIComponent(token)}`;
  return queueMail({ userId, to: email, purpose: "email_verify", subject: "Verify your Cloudhug Kiwi Router email", html: `<p>Welcome to Cloudhug's Kiwi Router.</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 30 minutes.</p>` });
}

export async function sendPasswordResetEmail(req: Request, userId: number, email: string, token: string) {
  const url = `${appOrigin(req)}/reset-password?token=${encodeURIComponent(token)}`;
  return queueMail({ userId, to: email, purpose: "password_reset", subject: "Reset your Cloudhug Kiwi Router password", html: `<p>A password reset was requested for your account.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 20 minutes. If you did not request it, you can ignore this email.</p>` });
}

export function describeEmailDelivery() {
  return "Queued in Neon email_outbox; no external email provider is configured.";
}

export function getAuthLink(req: Request, purpose: "email_verify" | "password_reset", token: string) {
  const path = purpose === "email_verify" ? "/verify-email" : "/reset-password";
  return `${appOrigin(req)}${path}?token=${encodeURIComponent(token)}`;
}

export { appOrigin };

const _unused = describeEmailDelivery;
void _unused;
