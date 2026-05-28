// lib/pipeline/gateway/providers/groq.ts
import Groq from "groq-sdk";
import type { GatewayResponse, ModelConfig } from "@/lib/types";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[groq] GROQ_API_KEY is not set in .env.local"
    );
  }
  return new Groq({ apiKey });
}

export async function callGroq(
  config: ModelConfig,
  prompt: string,
  systemPrompt?: string
): Promise<GatewayResponse> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens ?? 2000,
    temperature: config.temperature ?? 0.1,
    messages: [
      {
        role: "system",
        content: systemPrompt ?? "You are a precise JSON generator. Return only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
  });

  const latencyMs = Date.now() - startTime;
  const content = response.choices[0]?.message?.content ?? "";
  const tokensIn = response.usage?.prompt_tokens ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;

  return {
    content,
    tokensIn,
    tokensOut,
    provider: "groq",
    model: config.model,
    latencyMs,
  };
}