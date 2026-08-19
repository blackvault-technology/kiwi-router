import { describe, expect, it } from "vitest";
import type { Express } from "express";
import { registerGateway } from "./gateway";

describe("gateway contract", () => {
  it("registers the required OpenAI-compatible completions endpoint", () => {
    const routes: string[] = [];
    const app = {
      post: (path: string) => {
        routes.push(path);
      },
    } as unknown as Express;

    registerGateway(app);

    expect(routes).toContain("/api/v1/chat/completions");
  });
});
