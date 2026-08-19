import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  archiveModel: vi.fn(),
  archiveProvider: vi.fn(),
  createModel: vi.fn(),
  recordSecurityEvent: vi.fn(),
  saveProvider: vi.fn(),
  syncProviderModels: vi.fn(),
  testProviderConnection: vi.fn(),
  updateModel: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), ...databaseMocks }));
vi.mock("./security", () => ({
  assertSafeUpstreamUrl: vi.fn(),
  enforceAuthRateLimits: vi.fn(),
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function founderContext(): TrpcContext {
  return {
    user: {
      id: 1,
      name: "Adarsh Kushwah",
      email: "indiasikhotechno@gmail.com",
      passwordHash: "unused-in-test",
      role: "founder",
      isDisabled: false,
      emailVerified: true,
      stipendCredits: "0",
      purchasedCredits: "50",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as TrpcContext["user"],
    req: { headers: {}, header: () => undefined } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function standardUserContext(): TrpcContext {
  return {
    ...founderContext(),
    user: { ...founderContext().user!, id: 9, email: "developer@example.com", role: "user" },
  };
}

describe("founder management mutation execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.saveProvider.mockResolvedValue({ id: 11, slug: "openai" });
    databaseMocks.createModel.mockResolvedValue({ id: 12, slug: "kiwi/openai-gpt-4" });
    databaseMocks.updateModel.mockResolvedValue({ id: 12, slug: "kiwi/openai-gpt-4" });
    databaseMocks.testProviderConnection.mockResolvedValue({ ok: true, statusCode: 200, latencyMs: 19, detail: "Catalog handshake succeeded" });
    databaseMocks.syncProviderModels.mockResolvedValue({ discovered: 3, mode: "automatic" });
    databaseMocks.archiveProvider.mockResolvedValue({ id: 11, slug: "openai" });
    databaseMocks.archiveModel.mockResolvedValue({ id: 12, slug: "kiwi/openai-gpt-4" });
    databaseMocks.recordSecurityEvent.mockResolvedValue(undefined);
  });

  it("executes provider save, test, sync, and retirement actions with safe audit metadata", async () => {
    const caller = appRouter.createCaller(founderContext());
    await caller.admin.saveProvider({ slug: "openai", displayName: "OpenAI", baseUrl: "https://api.openai.com/v1", isEnabled: true });
    await caller.admin.saveProvider({ slug: "openai", displayName: "OpenAI", baseUrl: "https://api.openai.com/v1", isEnabled: false });
    await caller.admin.testProviderConnection({ providerId: 11 });
    await caller.admin.syncProviderModels({ providerId: 11 });
    await caller.admin.archiveProvider({ providerId: 11 });

    expect(databaseMocks.saveProvider).toHaveBeenCalledTimes(2);
    expect(databaseMocks.testProviderConnection).toHaveBeenCalledWith(11);
    expect(databaseMocks.syncProviderModels).toHaveBeenCalledWith(11);
    expect(databaseMocks.archiveProvider).toHaveBeenCalledWith(11);
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_provider_saved", metadata: expect.objectContaining({ providerId: 11, credentialChanged: false }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_provider_saved", metadata: expect.objectContaining({ providerId: 11, isEnabled: false }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_provider_test", metadata: expect.objectContaining({ providerId: 11, ok: true, statusCode: 200 }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_provider_sync", metadata: expect.objectContaining({ providerId: 11, discovered: 3 }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_provider_archived", metadata: { providerId: 11, slug: "openai" } }));
  });

  it("executes route creation, complete editing, enablement changes, and archival with audit events", async () => {
    const caller = appRouter.createCaller(founderContext());
    await caller.admin.createModel({ slug: "kiwi/openai-gpt-4", displayName: "GPT-4", providerId: 11, upstreamId: "gpt-4", contextWindow: 128000, inputPrice: "0", outputPrice: "0", isEnabled: false });
    await caller.admin.updateModel({ id: 12, displayName: "GPT-4 updated", upstreamId: "gpt-4.1", isEnabled: true, creditCostPer1kTokens: "1.250" });
    await caller.admin.updateModel({ id: 12, isEnabled: false });
    await caller.admin.archiveModel({ id: 12 });

    expect(databaseMocks.createModel).toHaveBeenCalledWith(expect.objectContaining({ providerId: 11, isEnabled: false }));
    expect(databaseMocks.updateModel).toHaveBeenCalledWith(12, expect.objectContaining({ displayName: "GPT-4 updated", upstreamId: "gpt-4.1", isEnabled: true }));
    expect(databaseMocks.updateModel).toHaveBeenCalledWith(12, { isEnabled: false });
    expect(databaseMocks.archiveModel).toHaveBeenCalledWith(12);
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_model_created", metadata: expect.objectContaining({ modelId: 12, providerId: 11 }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_model_updated", metadata: expect.objectContaining({ modelId: 12, isEnabled: true }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_model_updated", metadata: expect.objectContaining({ modelId: 12, isEnabled: false }) }));
    expect(databaseMocks.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "founder_model_archived", metadata: { modelId: 12, slug: "kiwi/openai-gpt-4" } }));
  });

  it("rejects founder management mutations for a standard user before any provider or model helper runs", async () => {
    const caller = appRouter.createCaller(standardUserContext());
    await expect(caller.admin.testProviderConnection({ providerId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updateModel({ id: 12, isEnabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(databaseMocks.testProviderConnection).not.toHaveBeenCalled();
    expect(databaseMocks.updateModel).not.toHaveBeenCalled();
  });
});
