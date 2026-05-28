// lib/pipeline/gateway/providers/deepseek.ts
// STUB — not yet implemented. DeepSeek uses OpenAI-compatible API.
import type { GatewayResponse, ModelConfig } from "@/lib/types";

export async function callDeepSeek(
  _config: ModelConfig,
  _prompt: string,
  _systemPrompt?: string
): Promise<GatewayResponse> {
  throw new Error(
    "[deepseek] Provider not yet implemented. Use OpenAI SDK with DeepSeek base URL."
  );
}