import { describe, expect, it } from "vitest";
import { anthopicCompletion, anthopicPayload } from "./gateway";
import { readFileSync } from "node:fs";

describe("Anthropic gateway adapter", () => {
  it("merges provider-level adapter configuration before model-level overrides", () => {
    const source = readFileSync(new URL("./gateway.ts", import.meta.url), "utf8");
    expect(source).toContain("providerProtocol");
    expect(source).toContain("providerHeaders");
    expect(source).toContain("routing.protocol ?? providerProtocol");
    expect(source).toContain("...(providerHeaders ?? {}), ...(routing.headers ?? {})");
  });
  it("separates the system message and creates a provider-compatible request", () => {
    const payload = anthopicPayload({
      stream: false,
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Hello" },
      ],
    }, "claude-3-5-sonnet-latest");

    expect(payload).toMatchObject({
      model: "claude-3-5-sonnet-latest",
      stream: false,
      system: "Be concise.",
      messages: [{ role: "user", content: "Hello" }],
    });
  });

  it("normalizes real Anthropic usage and output to an OpenAI-compatible response", () => {
    const normalized = anthopicCompletion({
      id: "msg_123",
      content: [{ type: "text", text: "Gateway response" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 11, output_tokens: 7 },
    }, "kiwi/claude-sonnet");

    expect(normalized.inputTokens).toBe(11);
    expect(normalized.outputTokens).toBe(7);
    expect(normalized.completion.usage).toEqual({ prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
    expect(normalized.completion.choices[0]?.message.content).toBe("Gateway response");
  });
});
