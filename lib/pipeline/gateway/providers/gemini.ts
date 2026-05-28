// lib/pipeline/gateway/providers/gemini.ts
// STUB — not yet implemented. Use @google/generative-ai SDK.
import type { GatewayResponse, ModelConfig } from "@/lib/types";

export async function callGemini(
  _config: ModelConfig,
  _prompt: string,
  _systemPrompt?: string
): Promise<GatewayResponse> {
  throw new Error(
    "[gemini] Provider not yet implemented. Add Google Generative AI SDK call here."
  );
}