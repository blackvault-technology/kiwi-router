import type { Request, Response } from "express";
import { createApp } from "../server/app";

const app = createApp();

export default async function handler(req: Request, res: Response) {
  return (await app)(req, res);
}
