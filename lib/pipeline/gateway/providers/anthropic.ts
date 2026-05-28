// lib/pipeline/gateway/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { GatewayResponse, ModelConfig } from "@/lib/types";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[anthropic] ANTHROPIC_API_KEY is not set in .env.local"
    );
  }
  return new Anthropic({ apiKey });
}

export async function callAnthropic(
  config: ModelConfig,
  prompt: string,
  systemPrompt?: string
): Promise<GatewayResponse> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens ?? 2000,
    temperature: config.temperature ?? 0.1,
    system: systemPrompt ?? "You are a precise JSON generator. Return only valid JSON.",
    messages: [{ role: "user", content: prompt }],
  });

  const latencyMs = Date.now() - startTime;
  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return {
    content,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    provider: "anthropic",
    model: config.model,
    latencyMs,
  };
}