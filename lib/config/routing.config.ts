// lib/config/routing.config.ts
// Currently routed to Groq only (free tier)
import type { ModelConfig, PipelineStage, ProviderId } from "@/lib/types";

export interface StageRoutingConfig {
  primary: ModelConfig;
  fallback: ModelConfig;
  openRouterFallback: ModelConfig;
  costThresholdUSD?: number;
  latencyThresholdMs?: number;
}

export type RoutingConfig = Record<PipelineStage, StageRoutingConfig>;

const routing: RoutingConfig = {
  intent_extraction: {
    primary: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      maxTokens: 800,
      temperature: 0.2,
    },
    fallback: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 800,
      temperature: 0.2,
    },
    openRouterFallback: {
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 800,
      temperature: 0.2,
    },
    latencyThresholdMs: 3000,
  },

  schema_generation: {
    primary: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 2000,
      temperature: 0.1,
    },
    fallback: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      maxTokens: 2000,
      temperature: 0.1,
    },
    openRouterFallback: {
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 2000,
      temperature: 0.1,
    },
    costThresholdUSD: 0.05,
  },

  appspec_generation: {
    // Using faster smaller model as primary to avoid rate limits
    // 70b as fallback for quality when needed
    primary: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      maxTokens: 3000,
      temperature: 0.1,
    },
    fallback: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 3000,
      temperature: 0.1,
    },
    openRouterFallback: {
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 3000,
      temperature: 0.1,
    },
    costThresholdUSD: 0.08,
  },

  repair: {
    primary: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      maxTokens: 1500,
      temperature: 0.1,
    },
    fallback: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 1500,
      temperature: 0.1,
    },
    openRouterFallback: {
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 1500,
      temperature: 0.1,
    },
  },
};

export default routing;

export function getPrimaryConfig(stage: PipelineStage): ModelConfig {
  return routing[stage].primary;
}

export function getFallbackConfig(stage: PipelineStage): ModelConfig {
  return routing[stage].fallback;
}

export function getOpenRouterFallback(stage: PipelineStage): ModelConfig {
  return routing[stage].openRouterFallback;
}

export function getRepairConfig(
  failedProvider: ProviderId,
  failedModel: string
): ModelConfig {
  return {
    provider: failedProvider,
    model: failedModel,
    maxTokens: 1500,
    temperature: 0.1,
  };
}