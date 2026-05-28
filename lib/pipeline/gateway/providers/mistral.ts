// lib/pipeline/gateway/providers/mistral.ts
// STUB — not yet implemented. Use @mistralai/mistralai SDK.
import type { GatewayResponse, ModelConfig } from "@/lib/types";

export async function callMistral(
  _config: ModelConfig,
  _prompt: string,
  _systemPrompt?: string
): Promise<GatewayResponse> {
  throw new Error(
    "[mistral] Provider not yet implemented. Add Mistral SDK call here."
  );
}