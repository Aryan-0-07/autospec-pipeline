// lib/pipeline/gateway/providers/google_ai.ts
// STUB — not yet implemented. Fallback for Gemini via Google AI SDK.
import type { GatewayResponse, ModelConfig } from "@/lib/types";

export async function callGoogleAI(
  _config: ModelConfig,
  _prompt: string,
  _systemPrompt?: string
): Promise<GatewayResponse> {
  throw new Error(
    "[google_ai] Provider not yet implemented. Add Google AI SDK call here."
  );
}