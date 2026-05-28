// lib/pipeline/gateway/gateway.ts
import type {
  GatewayOptions, GatewayResponse, ModelConfig,
  PipelineStage, ProviderId, StageCost,
} from "@/lib/types";
import { getFallbackConfig, getOpenRouterFallback, getPrimaryConfig } from "@/lib/config/routing.config";
import { estimateCostUSD } from "@/lib/config/cost.table";
import { callAnthropic } from "./providers/anthropic";
import { callGroq } from "./providers/groq";
import { callOpenRouter } from "./providers/openrouter";
import { callOpenAI } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callGoogleAI } from "./providers/google_ai";
import { callDeepSeek } from "./providers/deepseek";
import { callMistral } from "./providers/mistral";

async function dispatchToProvider(
  config: ModelConfig, prompt: string, systemPrompt?: string
): Promise<GatewayResponse> {
  switch (config.provider) {
    case "anthropic":  return callAnthropic(config, prompt, systemPrompt);
    case "groq":       return callGroq(config, prompt, systemPrompt);
    case "openrouter": return callOpenRouter(config, prompt, systemPrompt);
    case "openai":     return callOpenAI(config, prompt, systemPrompt);
    case "gemini":     return callGemini(config, prompt, systemPrompt);
    case "google_ai":  return callGoogleAI(config, prompt, systemPrompt);
    case "deepseek":   return callDeepSeek(config, prompt, systemPrompt);
    case "mistral":    return callMistral(config, prompt, systemPrompt);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate limit") ||
      msg.includes("500") || msg.includes("502") ||
      msg.includes("503") || msg.includes("504") ||
      msg.includes("overloaded") || msg.includes("timeout");
  }
  return false;
}

export async function callModel(
  stage: PipelineStage, prompt: string, options?: GatewayOptions
): Promise<{ response: GatewayResponse; cost: StageCost }> {
  const primaryConfig = options?.forceProvider
    ? { ...getPrimaryConfig(stage), provider: options.forceProvider }
    : getPrimaryConfig(stage);

  const attempts = [
    { config: primaryConfig,               label: "primary"     },
    { config: getFallbackConfig(stage),    label: "fallback"    },
    { config: getOpenRouterFallback(stage), label: "openrouter" },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      console.log(`[gateway] stage=${stage} attempt=${attempt.label} provider=${attempt.config.provider} model=${attempt.config.model}`);

      const response = await Promise.race([
        dispatchToProvider(attempt.config, prompt, options?.systemPrompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("429 timeout after 30s")), 30000)
        ),
      ]);

      const estimatedUSD = estimateCostUSD(
        attempt.config.provider, attempt.config.model,
        response.tokensIn, response.tokensOut
      );
      const cost: StageCost = {
        stage, provider: attempt.config.provider, model: attempt.config.model,
        tokensIn: response.tokensIn, tokensOut: response.tokensOut,
        estimatedUSD, latencyMs: response.latencyMs,
      };
      console.log(`[gateway] success stage=${stage} latency=${response.latencyMs}ms cost=$${estimatedUSD}`);
      return { response, cost };

    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      console.warn(
        `[gateway] ${attempt.label} failed stage=${stage} provider=${attempt.config.provider} retryable=${isRetryable}`,
        error instanceof Error ? error.message : error
      );
      if (!isRetryable) break;
      // Wait 3 seconds before trying next provider
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(
    `[gateway] All providers failed for stage=${stage}. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export type { ProviderId };