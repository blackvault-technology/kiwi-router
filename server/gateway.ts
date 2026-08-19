import { Readable, Transform } from "node:stream";
import type { Express, Request, Response } from "express";
import { decryptSecret } from "./crypto";
import { checkRateLimit, getApiKeyOwner, getGatewayRoute, isAccessBanned, logRequest } from "./db";
import { canSpendCredits, spendCredits } from "./credits";
import { getRequestIp } from "./founder";
import { hashApiKey } from "./auth";

function requestApiKey(req: Request) {
  const authorization = req.header("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : req.header("x-api-key")?.trim();
}

function respondError(res: Response, status: number, message: string, code: string) {
  return res.status(status).json({ error: { message, type: "gateway_error", code } });
}

type ChatMessage = { role?: string; content?: unknown };

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
  app.post("/api/v1/chat/completions", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
    const startedAt = Date.now();
    const apiKey = requestApiKey(req);
    if (!apiKey) return respondError(res, 401, "Missing API key", "invalid_api_key");
    const owner = await getApiKeyOwner(apiKey);
    if (!owner) return respondError(res, 401, "Invalid or revoked API key", "invalid_api_key");
    const ipAddress = getRequestIp(req.headers);
    const userAgentHash = req.header("user-agent") ? hashApiKey(req.header("user-agent")!) : undefined;
    if (await isAccessBanned(owner.user.id, owner.user.email, ipAddress)) return respondError(res, 403, "Access is blocked", "access_banned");
    const body = req.body as { model?: string; stream?: boolean; messages?: ChatMessage[]; max_tokens?: number; stream_options?: Record<string, unknown> };
    if (!body?.model) return respondError(res, 400, "The `model` field is required", "invalid_request_error");
    const rate = await checkRateLimit(owner.user.id, ipAddress);
    if (!rate.allowed) return respondError(res, 429, "Rate limit exceeded", "rate_limit_exceeded");
    const route = await getGatewayRoute(body.model);
    if (!route) return respondError(res, 404, `Model '${body.model}' is unavailable`, "model_not_found");
    const creditCheck = await canSpendCredits(owner.user, route.model.slug, body.max_tokens ?? 1024);
    if (!creditCheck.allowed) return respondError(res, 402, `Insufficient Kiwi Credits. ${creditCheck.required} credits are required; your balance is ${creditCheck.balance}.`, "insufficient_credits");
    if (!route.provider.encryptedApiKey) return respondError(res, 503, `The ${route.provider.displayName} provider is not configured`, "provider_not_configured");

    try {
      const isAnthropic = route.provider.slug === "anthropic";
      const upstream = await fetch(`${route.provider.baseUrl.replace(/\/$/, "")}${isAnthropic ? "/messages" : "/chat/completions"}`, {
        method: "POST",
        headers: isAnthropic
          ? { "Content-Type": "application/json", "x-api-key": decryptSecret(route.provider.encryptedApiKey), "anthropic-version": "2023-06-01" }
          : { "Content-Type": "application/json", Authorization: `Bearer ${decryptSecret(route.provider.encryptedApiKey)}` },
        body: JSON.stringify(isAnthropic ? anthopicPayload(body, route.model.upstreamId) : { ...body, model: route.model.upstreamId, ...(body.stream ? { stream_options: { ...body.stream_options, include_usage: true } } : {}) }),
      });
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
