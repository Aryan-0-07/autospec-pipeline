// lib/pipeline/gateway/providers/openai.ts
// STUB — not yet implemented. Uses OpenAI SDK with api.openai.com base URL.
import type { GatewayResponse, ModelConfig } from "@/lib/types";

export async function callOpenAI(
  _config: ModelConfig,
  _prompt: string,
  _systemPrompt?: string
): Promise<GatewayResponse> {
  throw new Error(
    "[openai] Provider not yet implemented. Add OpenAI SDK call here."
  );
}