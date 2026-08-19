import { randomBytes } from "node:crypto";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import { createUser, getGoogleIdentity, getGoogleIdentityByEmail, getUserById, getUserByEmail, markEmailVerified, recordSecurityEvent, upsertGoogleIdentity } from "./db";
import { hashPassword, startSession } from "./auth";
import { normalizeEmail } from "./founder";

const STATE_COOKIE = "kiwi_google_state";
const STATE_TTL_SECONDS = 600;

type GoogleUserInfo = { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string };

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET must be configured");
  return new TextEncoder().encode(value);
}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return { clientId, clientSecret, redirectUri };
}

async function createState() {
  return new SignJWT({ nonce: randomBytes(18).toString("base64url") })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${STATE_TTL_SECONDS}s`).sign(secret());
}

async function verifyState(value: string) {
  const result = await jwtVerify(value, secret());
  return typeof result.payload.nonce === "string";
}

async function exchangeCode(code: string) {
  const oauth = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: oauth.clientId, client_secret: oauth.clientSecret, redirect_uri: oauth.redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("Google authorization failed");
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google authorization did not return an access token");
  const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!profile.ok) throw new Error("Google profile lookup failed");
  return await profile.json() as GoogleUserInfo;
}

async function resolveUser(profile: GoogleUserInfo) {
  if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error("Google account email is not verified");
  const email = normalizeEmail(profile.email);
  const existingIdentity = await getGoogleIdentity(profile.sub);
  if (existingIdentity) return getUserById(existingIdentity.userId);
  const existingUser = await getUserByEmail(email);
  const user = existingUser ?? await createUser({ name: (profile.name ?? email.split("@")[0]).slice(0, 100), email, passwordHash: await hashPassword(randomBytes(32).toString("base64url")) });
  if (!user) throw new Error("Unable to create Google account");
  if (!user.emailVerifiedAt) await markEmailVerified(user.id);
  await upsertGoogleIdentity({ userId: user.id, googleSubject: profile.sub, email, displayName: (profile.name ?? user.name).slice(0, 160), avatarUrl: profile.picture });
  return getUserById(user.id);
}

export function registerGoogleAuth(app: Express) {
  app.get("/api/auth/google", async (_req: Request, res: Response) => {
    try {
      const oauth = config();
      const state = await createState();
      res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: STATE_TTL_SECONDS * 1000, path: "/" });
      const params = new URLSearchParams({ client_id: oauth.clientId, redirect_uri: oauth.redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    } catch {
      return res.status(503).json({ error: "Google sign-in is not configured" });
    }
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const state = parse(req.headers.cookie ?? "")[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    try {
      if (!state || typeof req.query.state !== "string" || req.query.state !== state || !(await verifyState(state))) return res.redirect("/login?error=google_state");
      if (typeof req.query.code !== "string") return res.redirect("/login?error=google_code");
      const profile = await exchangeCode(req.query.code);
      const user = await resolveUser(profile);
      if (!user || user.isDisabled) return res.redirect("/login?error=google_account");
      await startSession(res, user);
      await recordSecurityEvent({ eventType: "google_login_success", userId: user.id, ipAddress: req.ip, metadata: { googleSubject: profile.sub } });
      return res.redirect("/");
    } catch {
      return res.redirect("/login?error=google_failed");
    }
  });
}
