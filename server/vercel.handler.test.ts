import { describe, expect, it, vi } from "vitest";

describe("Vercel serverless handler", () => {
  it("re-exports the shared handler from the catch-all API route", async () => {
    vi.resetModules();
    vi.doMock("../server/app", () => ({ createApp: vi.fn() }));
    const { default: rootHandler } = await import("../api/index");
    const { default: catchAllHandler } = await import("../api/[...path]");

    expect(catchAllHandler).toBe(rootHandler);
  });

  it("returns a safe JSON 503 response if application initialization fails", async () => {
    vi.resetModules();
    vi.doMock("../server/app", () => ({ createApp: vi.fn().mockRejectedValue(new Error("missing configuration")) }));
    const { default: handler } = await import("../api/index");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    await handler({} as Request, { status } as unknown as Response);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: {
        message: "The API is temporarily unavailable during initialization.",
        type: "service_unavailable",
        code: "api_initialization_failed",
      },
    });
  });
});
