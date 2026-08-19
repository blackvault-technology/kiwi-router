import type { Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type NextFunction, type Request, type Response } from "express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerStorageProxy } from "./_core/storageProxy";
import { registerGateway } from "./gateway";
import { getSessionUser } from "./auth";
import { FOUNDER_EMAIL, getRequestIp } from "./founder";
import { dailyCreditMaintenance } from "./credits";
import { ensureFounderAccount } from "./founderBootstrap";
import { registerStripeWebhook } from "./stripeCredits";
import { banIpAddress } from "./db";
import { corsGuard, globalApiRateLimit, securityHeaders } from "./httpSecurity";

export async function createApp(options: { developmentServer?: Server; serveStaticFiles?: boolean } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  await ensureFounderAccount();
  registerStripeWebhook(app);
  app.use(securityHeaders);
  app.use(corsGuard);
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(express.urlencoded({ limit: "64kb", extended: false }));
  app.use("/api", globalApiRateLimit);
  app.use("/admin", async (req: Request, res: Response, next: NextFunction) => {
    const user = await getSessionUser(req);
    if (!user || user.email !== FOUNDER_EMAIL || user.role !== "founder") return res.status(403).json({ error: "Founder access required" });
    next();
  });
  app.post("/api/scheduled/daily-credits", async (req: Request, res: Response) => {
    if (!process.env.CREDIT_CRON_SECRET || req.header("x-kiwi-cron-secret") !== process.env.CREDIT_CRON_SECRET) return res.status(403).json({ error: "cron-only" });
    try { return res.json({ ok: true, ...(await dailyCreditMaintenance()) }); } catch { return res.status(500).json({ error: "Daily credit maintenance failed" }); }
  });
  app.all("/api/v1/.well-known/health-probe", async (req: Request, res: Response) => { await banIpAddress(req.ip || getRequestIp(req.headers) || "unknown", "Honeypot endpoint accessed"); return res.status(404).json({ error: "Not found" }); });
  registerStorageProxy(app);
  registerGateway(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (options.developmentServer) {
    const { setupVite } = await import("./_core/vite");
    await setupVite(app, options.developmentServer);
  } else if (options.serveStaticFiles) {
    const { serveStatic } = await import("./_core/vite");
    serveStatic(app);
  }
  return app;
}
