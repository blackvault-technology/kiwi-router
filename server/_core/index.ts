import { createServer } from "http";
import net from "net";
import { createApp } from "../app";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => { const server = net.createServer(); server.listen(port, () => server.close(() => resolve(true))); server.on("error", () => resolve(false)); });
}

async function findAvailablePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 20; port += 1) if (await isPortAvailable(port)) return port;
  throw new Error("No available application port found");
}

async function startServer() {
  const server = createServer();
  const app = await createApp();
  if (process.env.NODE_ENV === "production") serveStatic(app);
  else await setupVite(app, server);
  server.on("request", app);
  const port = await findAvailablePort(Number(process.env.PORT ?? 3000));
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

void startServer();
