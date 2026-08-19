import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerGateway } from "../gateway";
import { serveStatic, setupVite } from "./vite";
import { getSessionUser } from "../auth";
import { FOUNDER_EMAIL } from "../founder";
import { dailyCreditMaintenance } from "../credits";
import { ensureFounderAccount } from "../founderBootstrap";
import { registerStripeWebhook } from "../stripeCredits";
import { banIpAddress } from "../db";
import { getRequestIp } from "../founder";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 20; port += 1) if (await isPortAvailable(port)) return port;
  throw new Error("No available application port found");
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  await ensureFounderAccount();
  registerStripeWebhook(app);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.use("/admin", async (req, res, next) => {
    const user = await getSessionUser(req);
    if (!user || user.email !== FOUNDER_EMAIL || user.role !== "founder") return res.status(403).json({ error: "Founder access required" });
    next();
  });
  app.post("/api/scheduled/daily-credits", async (req, res) => {
    if (!process.env.CREDIT_CRON_SECRET || req.header("x-kiwi-cron-secret") !== process.env.CREDIT_CRON_SECRET) return res.status(403).json({ error: "cron-only" });
    try {
      return res.json({ ok: true, ...(await dailyCreditMaintenance()) });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Daily credit maintenance failed", timestamp: new Date().toISOString() });
    }
  });
  app.all("/api/v1/.well-known/health-probe", async (req, res) => {
    await banIpAddress(getRequestIp(req.headers) ?? "unknown", "Honeypot endpoint accessed");
    return res.status(404).json({ error: "Not found" });
  });
  registerStorageProxy(app);
  registerGateway(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const port = await findAvailablePort(Number(process.env.PORT ?? 3000));
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

void startServer();
