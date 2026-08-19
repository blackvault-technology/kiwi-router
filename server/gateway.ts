import { Readable, Transform } from "node:stream";
import type { Express, Request, Response } from "express";
import { decryptSecret } from "./crypto";
import { checkRateLimit, getApiKeyOwner, getGatewayFallbackRoute, getGatewayRoute, getProviderRuntimeCredential, getRateLimitSettings, isAccessBanned, listModels, listProviders, logRequest } from "./db";
import { canSpendCredits, spendCredits } from "./credits";
import { getRequestIp } from "./founder";
import { hashApiKey } from "./auth";
import { assertSafeUpstreamUrl } from "./security";
import { z } from "zod";

function requestApiKey(req: Request) {
  const authorization = req.header("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : req.header("x-api-key")?.trim();
}

function respondError(res: Response, status: number, message: string, code: string) {
  return res.status(status).json({ error: { message, type: "gateway_error", code } });
}

export type StatusLevel = "operational" | "degraded";
export type StatusComponent = { id: string; name: string; status: StatusLevel; latencyMs: number; detail: string };

export function overallStatus(components: StatusComponent[]): StatusLevel {
  return components.every(component => component.status === "operational") ? "operational" : "degraded";
}

async function measureStatus<T>(check: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    return { ok: true as const, value: await check(), latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false as const, latencyMs: Date.now() - startedAt };
  }
}

/**
 * Produces a public, low-cost operational view without probing providers with secrets,
 * sending a model request, or exposing configured endpoint/key information.
 */
export async function getPublicApiStatus() {
  const [databaseProbe, providerProbe, modelProbe] = await Promise.all([
    measureStatus(() => getRateLimitSettings()),
    measureStatus(() => listProviders()),
    measureStatus(() => listModels(true)),
  ]);

  const configuredProviderCount = providerProbe.ok
    ? providerProbe.value.filter(provider => provider.isEnabled && provider.isConfigured).length
    : 0;
  const enabledModelCount = modelProbe.ok ? modelProbe.value.length : 0;
  const gatewayEnabled = databaseProbe.ok ? databaseProbe.value.globalApiEnabled !== false : false;

  const components: StatusComponent[] = [
    { id: "database", name: "Neon database", status: databaseProbe.ok ? "operational" : "degraded", latencyMs: databaseProbe.latencyMs, detail: databaseProbe.ok ? "Connectivity check succeeded" : "Connectivity check failed" },
    { id: "gateway", name: "OpenAI-compatible gateway", status: databaseProbe.ok && gatewayEnabled ? "operational" : "degraded", latencyMs: databaseProbe.latencyMs, detail: databaseProbe.ok ? gatewayEnabled ? "Request routing is enabled" : "Request routing is paused by the global safety switch" : "Dependent database check is unavailable" },
    { id: "models", name: "Enabled model catalog", status: modelProbe.ok && enabledModelCount > 0 ? "operational" : "degraded", latencyMs: modelProbe.latencyMs, detail: modelProbe.ok ? `${enabledModelCount} enabled route${enabledModelCount === 1 ? "" : "s"}` : "Catalog check failed" },
    { id: "providers", name: "Provider configuration", status: providerProbe.ok && configuredProviderCount > 0 ? "operational" : "degraded", latencyMs: providerProbe.latencyMs, detail: providerProbe.ok ? `${configuredProviderCount} configured provider${configuredProviderCount === 1 ? "" : "s"}` : "Configuration check failed" },
  ];

  return { status: overallStatus(components), service: "cloudhug-kiwi-router", checkedAt: new Date().toISOString(), components };
}

type ChatMessage = { role?: string; content?: unknown };

const completionSchema = z.object({
  model: z.string().trim().min(1).max(120),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant", "tool"]).optional(), content: z.union([z.string().max(50_000), z.array(z.unknown()).max(32)]).optional() })).min(1).max(64),
  stream: z.boolean().optional().default(false),
  max_tokens: z.number().int().min(1).max(8192).optional(),
  stream_options: z.record(z.string(), z.unknown()).optional(),
}).strict();

export function anthopicPayload(body: { messages?: ChatMessage[]; stream?: boolean; max_tokens?: number }, upstreamModel: string) {
  const messages = body.messages ?? [];
  const system = messages
    .filter(message => message.role === "system" && typeof message.content === "string")
    .map(message => message.content as string)
    .join("\n\n");
  return {
    model: upstreamModel,
    max_tokens: body.max_tokens ?? 1024,
    stream: Boolean(body.stream),
    ...(system ? { system } : {}),
    messages: messages
      .filter(message => message.role === "user" || message.role === "assistant")
      .map(message => ({ role: message.role, content: typeof message.content === "string" ? message.content : "" })),
  };
}

export function anthopicCompletion(payload: any, publicModel: string) {
  const inputTokens = Number(payload?.usage?.input_tokens ?? 0);
  const outputTokens = Number(payload?.usage?.output_tokens ?? 0);
  return {
    completion: {
      id: payload?.id ?? `chatcmpl_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: publicModel,
      choices: [{
        index: 0,
        message: { role: "assistant", content: (payload?.content ?? []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("") },
        finish_reason: payload?.stop_reason ?? "stop",
      }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    },
    inputTokens,
    outputTokens,
  };
}

function createAnthropicSseAdapter(publicModel: string, usage: { inputTokens: number; outputTokens: number }) {
  let buffer = "";
  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find(line => line.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.type === "message_start" && payload.message?.usage?.input_tokens !== undefined) usage.inputTokens = Number(payload.message.usage.input_tokens);
          if (payload.type === "message_delta" && payload.usage?.output_tokens !== undefined) usage.outputTokens = Number(payload.usage.output_tokens);
          if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
            this.push(`data: ${JSON.stringify({ id: payload.message?.id ?? `chatcmpl_${Date.now()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: publicModel, choices: [{ index: 0, delta: { content: payload.delta.text }, finish_reason: null }] })}\n\n`);
          }
          if (payload.type === "message_delta") {
            this.push(`data: ${JSON.stringify({ id: `chatcmpl_${Date.now()}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: publicModel, choices: [{ index: 0, delta: {}, finish_reason: payload.delta?.stop_reason ?? "stop" }] })}\n\n`);
          }
          if (payload.type === "message_stop") this.push("data: [DONE]\n\n");
        } catch {
          // Ignore malformed upstream SSE frames while preserving the stream.
        }
      }
      callback();
    },
  });
}

function createOpenAiUsageObserver(usage: { inputTokens: number; outputTokens: number }) {
  let buffer = "";
  return new Transform({
    transform(chunk, _encoding, callback) {
      this.push(chunk);
      buffer += chunk.toString();
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find(line => line.startsWith("data: "));
        if (!dataLine || dataLine === "data: [DONE]") continue;
        try {
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.usage) {
            usage.inputTokens = Number(payload.usage.prompt_tokens ?? usage.inputTokens);
            usage.outputTokens = Number(payload.usage.completion_tokens ?? usage.outputTokens);
          }
        } catch {
          // Forward malformed upstream frames without treating them as usage data.
        }
      }
      callback();
    },
  });
}

export function registerGateway(app: Express) {
  app.get("/api/v1/health", (_req, res) => res.status(200).json({ status: "ok", service: "cloudhug-kiwi-router", timestamp: new Date().toISOString() }));
  app.get(["/api/status", "/api/v1/status"], async (_req, res) => {
    const snapshot = await getPublicApiStatus();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(snapshot);
  });
  app.get("/api/v1/models", async (req, res) => {
    const apiKey = requestApiKey(req);
    if (!apiKey) return respondError(res, 401, "Missing API key", "invalid_api_key");
    const owner = await getApiKeyOwner(apiKey);
    if (!owner) return respondError(res, 401, "Invalid or revoked API key", "invalid_api_key");
    const ipAddress = req.ip || getRequestIp(req.headers);
    if (await isAccessBanned(owner.user.id, owner.user.email, ipAddress)) return respondError(res, 403, "Access is blocked", "access_banned");
    const rate = await checkRateLimit(owner.user.id, ipAddress);
    if (!rate.allowed) return respondError(res, 429, "Rate limit exceeded", "rate_limit_exceeded");
    const available = await listModels(true);
    return res.json({ object: "list", data: available.map(({ model }) => ({ id: model.slug, object: "model", created: Math.floor(model.createdAt.getTime() / 1000), owned_by: "cloudhug" })) });
  });
  app.post("/api/v1/chat/completions", async (req, res) => {
    const startedAt = Date.now();
    const apiKey = requestApiKey(req);
    if (!apiKey) return respondError(res, 401, "Missing API key", "invalid_api_key");
    const owner = await getApiKeyOwner(apiKey);
    if (!owner) return respondError(res, 401, "Invalid or revoked API key", "invalid_api_key");
    const ipAddress = req.ip || getRequestIp(req.headers);
    const userAgentHash = req.header("user-agent") ? hashApiKey(req.header("user-agent")!) : undefined;
    if (await isAccessBanned(owner.user.id, owner.user.email, ipAddress)) return respondError(res, 403, "Access is blocked", "access_banned");
    const parsed = completionSchema.safeParse(req.body);
    if (!parsed.success) return respondError(res, 400, "Invalid chat completion payload", "invalid_request_error");
    const body = parsed.data as { model: string; stream?: boolean; messages?: ChatMessage[]; max_tokens?: number; stream_options?: Record<string, unknown> };
    const rate = await checkRateLimit(owner.user.id, ipAddress);
    if (!rate.allowed) return respondError(res, 429, "Rate limit exceeded", "rate_limit_exceeded");
    let route = await getGatewayRoute(body.model);
    if (!route) return respondError(res, 404, `Model '${body.model}' is unavailable`, "model_not_found");
    const primaryRouting = (route.model.routingConfig ?? {}) as { fallbackProviderId?: number };
    if (!route.provider.isHealthy && primaryRouting.fallbackProviderId) {
      const fallback = await getGatewayFallbackRoute(body.model, primaryRouting.fallbackProviderId);
      if (fallback) route = fallback;
    }
    const creditCheck = await canSpendCredits(owner.user, route.model.slug, body.max_tokens ?? 1024);
    if (!creditCheck.allowed) return respondError(res, 402, `Insufficient Kiwi Credits. ${creditCheck.required} credits are required; your balance is ${creditCheck.balance}.`, "insufficient_credits");
    const runtimeCredential = await getProviderRuntimeCredential(route.provider.id);
    if (!runtimeCredential) return respondError(res, 503, `The ${route.provider.displayName} provider is not configured`, "provider_not_configured");

    try {
      const routing = (route.model.routingConfig ?? {}) as { protocol?: "openai" | "anthropic" | "gemini"; headers?: Record<string, string> };
      const providerProtocol = route.provider.protocol as "openai" | "anthropic" | "gemini" | undefined;
      const providerHeaders = (route.provider.requestHeaders ?? {}) as Record<string, string>;
      const protocol = routing.protocol ?? providerProtocol ?? (route.provider.slug === "anthropic" ? "anthropic" : "openai");
      const isAnthropic = protocol === "anthropic";
      const baseUrl = assertSafeUpstreamUrl(route.provider.baseUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const upstream = await fetch(`${baseUrl.toString().replace(/\/$/, "")}${isAnthropic ? "/messages" : "/chat/completions"}`, {
        method: "POST",
        headers: isAnthropic
          ? { "Content-Type": "application/json", "x-api-key": runtimeCredential, "anthropic-version": "2023-06-01", ...(providerHeaders ?? {}), ...(routing.headers ?? {}) }
          : { "Content-Type": "application/json", Authorization: `Bearer ${runtimeCredential}`, ...(providerHeaders ?? {}), ...(routing.headers ?? {}) },
        body: JSON.stringify(isAnthropic ? anthopicPayload(body, route.model.upstreamId) : { ...body, model: route.model.upstreamId, ...(body.stream ? { stream_options: { ...body.stream_options, include_usage: true } } : {}) }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const metadata = { userId: owner.user.id, apiKeyId: owner.apiKey.id, modelSlug: route.model.slug, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt, ipAddress, userAgentHash };
      res.status(upstream.status);
      const type = upstream.headers.get("content-type") ?? "application/json";
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "no-cache, no-transform");
      if (!upstream.ok || !upstream.body) {
        const errorPayload = await upstream.text();
        await logRequest({ ...metadata, status: "error", errorCode: `upstream_${upstream.status}` });
        return res.send(errorPayload);
      }
      if (!body.stream) {
        if (isAnthropic) {
          const normalized = anthopicCompletion(await upstream.json(), route.model.slug);
          const creditsDeducted = await spendCredits(owner.user.id, route.model.slug, normalized.inputTokens, normalized.outputTokens, `Gateway completion ${route.model.slug}`);
          await logRequest({ ...metadata, status: "success", inputTokens: normalized.inputTokens, outputTokens: normalized.outputTokens, creditsDeducted, latencyMs: Date.now() - startedAt });
          return res.json(normalized.completion);
        }
        const payload = await upstream.json() as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const inputTokens = Number(payload.usage?.prompt_tokens ?? 0); const outputTokens = Number(payload.usage?.completion_tokens ?? 0);
        const creditsDeducted = await spendCredits(owner.user.id, route.model.slug, inputTokens, outputTokens, `Gateway completion ${route.model.slug}`);
        await logRequest({ ...metadata, status: "success", inputTokens, outputTokens, creditsDeducted, latencyMs: Date.now() - startedAt });
        return res.json({ ...payload, model: route.model.slug });
      }
      const stream = Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream);
      const usage = { inputTokens: 0, outputTokens: 0 };
      const output = isAnthropic ? stream.pipe(createAnthropicSseAdapter(route.model.slug, usage)) : stream.pipe(createOpenAiUsageObserver(usage));
      output.on("end", () => { void (async () => { const creditsDeducted = await spendCredits(owner.user.id, route.model.slug, usage.inputTokens, usage.outputTokens, `Gateway stream ${route.model.slug}`); await logRequest({ ...metadata, status: "success", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, creditsDeducted, latencyMs: Date.now() - startedAt }); })(); });
      output.on("error", () => { void logRequest({ ...metadata, status: "error", latencyMs: Date.now() - startedAt, errorCode: "stream_error" }); });
      output.pipe(res);
    } catch (error) {
      await logRequest({ userId: owner.user.id, apiKeyId: owner.apiKey.id, modelSlug: body.model, status: "error", inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt, errorCode: "gateway_network_error" });
      return respondError(res, 502, error instanceof Error ? error.message : "The upstream provider could not be reached", "upstream_error");
    }
  });
}
