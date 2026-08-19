import type { Request, Response } from "express";
import { createApp } from "../server/app";
import type { Express } from "express";

let appPromise: Promise<Express> | undefined;

function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    return (await getApp())(req, res);
  } catch (error) {
    console.error("[Kiwi Router] Serverless application initialization failed", error);
    return res.status(503).json({
      error: {
        message: "The API is temporarily unavailable during initialization.",
        type: "service_unavailable",
        code: "api_initialization_failed",
      },
    });
  }
}
