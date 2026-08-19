import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { createSession, deleteSession, getSessionWithUser } from "./db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "kiwi_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, storedValue] = storedHash.split(":");
  if (!salt || !storedValue) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(storedValue, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDisabled: user.isDisabled,
    emailVerified: Boolean(user.emailVerifiedAt),
    stipendCredits: Number(user.stipendCredits),
    purchasedCredits: Number(user.purchasedCredits),
    kiwiCredits: Number(user.stipendCredits) + Number(user.purchasedCredits),
    createdAt: user.createdAt,
  };
}

export async function startSession(res: Response, user: User) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await createSession(user.id, expiresAt);
  const token = await new SignJWT({ sid: session.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingKey());

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

export async function endSession(req: Request, res: Response) {
  const token = parse(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (token) {
    try {
      const { payload } = await jwtVerify(token, signingKey());
      if (typeof payload.sid === "string") await deleteSession(payload.sid);
    } catch {
      // An invalid or expired token is cleared without revealing details.
    }
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function getSessionUser(req: Request) {
  const token = parse(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    const sessionRecord = await getSessionWithUser(payload.sid, Number(payload.sub));
    if (!sessionRecord || sessionRecord.expiresAt < new Date() || sessionRecord.isDisabled || !sessionRecord.emailVerifiedAt) return null;
    return sessionRecord;
  } catch {
    return null;
  }
}

export function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
