// lib/pipeline/gateway/providers/openrouter.ts
import OpenAI from "openai";
import type { GatewayResponse, ModelConfig } from "@/lib/types";

// Lazy client — only created when actually called
// Prevents crash on import when OPENROUTER_API_KEY is not set
function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[openrouter] OPENROUTER_API_KEY is not set in .env.local"
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AutoSpec Pipeline",
    },
  });
}

export async function callOpenRouter(
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
    provider: "openrouter",
    model: config.model,
    latencyMs,
  };
}