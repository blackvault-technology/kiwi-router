import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { takeRateLimit } from "./db";

const configuredOrigins = () => (process.env.APP_URL || "").split(",").map(value => value.trim()).filter(Boolean);

export function allowOrigin(origin?: string) {
  if (!origin) return true;
  const allowed = configuredOrigins();
  return allowed.length === 0 ? process.env.NODE_ENV !== "production" : allowed.includes(origin);
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()" );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  if (process.env.NODE_ENV === "production" && !req.path.startsWith("/api/")) res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:");
  next();
}

export function corsGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");
  if (origin && allowOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (origin && !allowOrigin(origin)) return res.status(403).json({ error: "Origin is not allowed" });
  next();
}

export async function globalApiRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const rate = await takeRateLimit({ scope: "http:ip", subject: ip, maxHits: 240, windowMs: 60_000 });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  } catch {
    return res.status(503).json({ error: "Request protection is temporarily unavailable" });
  }
}
