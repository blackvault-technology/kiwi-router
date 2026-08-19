import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  checkRateLimit: vi.fn(),
  getApiKeyOwner: vi.fn(),
  getGatewayRoute: vi.fn(),
  getRateLimitSettings: vi.fn(async () => ({ globalApiEnabled: true })),
  isAccessBanned: vi.fn(),
  listModels: vi.fn(async () => [{ model: { slug: "kiwi/gpt-4o-mini" }, provider: { slug: "openai" } }]),
  listProviders: vi.fn(async () => [{ id: 1, slug: "openai", displayName: "OpenAI", isEnabled: true, isConfigured: true }]),
  logRequest: vi.fn(),
}));

import { registerGateway } from "./gateway";

describe("GET /api/status", () => {
  it("returns the safe real component contract without provider secrets or URLs", async () => {
    let statusHandler: ((req: unknown, res: any) => Promise<unknown>) | undefined;
    const app = { get: vi.fn((path: string | string[], handler: unknown) => { if ((Array.isArray(path) ? path : [path]).includes("/api/status")) statusHandler = handler as typeof statusHandler; }), post: vi.fn() };
    registerGateway(app as never);
    const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);

    await statusHandler?.({}, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    const payload = response.json.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ status: "operational", service: "cloudhug-kiwi-router", components: expect.any(Array) });
    expect(payload.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "database", status: "operational", latencyMs: expect.any(Number) }),
      expect.objectContaining({ id: "gateway", status: "operational", latencyMs: expect.any(Number) }),
      expect.objectContaining({ id: "models", status: "operational", latencyMs: expect.any(Number) }),
      expect.objectContaining({ id: "providers", status: "operational", latencyMs: expect.any(Number) }),
    ]));
    expect(JSON.stringify(payload)).not.toMatch(/encryptedApiKey|api[_-]?key|baseUrl|secret/i);
  });
});
