// lib/config/cost.table.ts
import type { ProviderId } from "@/lib/types";

interface ModelCost {
  inputPer1M: number;
  outputPer1M: number;
}

const COST_TABLE: Record<string, ModelCost> = {
  // Anthropic
  "anthropic:claude-sonnet-4-20250514":          { inputPer1M: 3.00,  outputPer1M: 15.00 },
  "anthropic:claude-haiku-4-5-20251001":         { inputPer1M: 0.25,  outputPer1M: 1.25  },

  // OpenAI
  "openai:gpt-4o":                               { inputPer1M: 5.00,  outputPer1M: 15.00 },
  "openai:gpt-4o-mini":                          { inputPer1M: 0.15,  outputPer1M: 0.60  },

  // Groq
  "groq:llama-3.1-8b-instant":                   { inputPer1M: 0.05,  outputPer1M: 0.08  },
  "groq:llama-3.3-70b-versatile":                { inputPer1M: 0.59,  outputPer1M: 0.79  },
  "groq:llama3-70b-8192":                        { inputPer1M: 0.59,  outputPer1M: 0.79  },
  "groq:llama3-8b-8192":                         { inputPer1M: 0.05,  outputPer1M: 0.08  },
  "groq:mixtral-8x7b-32768":                     { inputPer1M: 0.27,  outputPer1M: 0.27  },

  // Gemini
  "gemini:gemini-1.5-flash":                     { inputPer1M: 0.075, outputPer1M: 0.30  },
  "gemini:gemini-1.5-pro":                       { inputPer1M: 3.50,  outputPer1M: 10.50 },

  // DeepSeek
  "deepseek:deepseek-chat":                      { inputPer1M: 0.14,  outputPer1M: 0.28  },
  "deepseek:deepseek-coder":                     { inputPer1M: 0.14,  outputPer1M: 0.28  },

  // Mistral
  "mistral:mistral-large-latest":                { inputPer1M: 8.00,  outputPer1M: 24.00 },
  "mistral:mistral-7b-instruct":                 { inputPer1M: 0.25,  outputPer1M: 0.25  },
  "mistral:mixtral-8x7b-instruct":               { inputPer1M: 0.70,  outputPer1M: 0.70  },

  // OpenRouter
  "openrouter:meta-llama/llama-3.1-8b-instruct": { inputPer1M: 0.06,  outputPer1M: 0.12  },
  "openrouter:meta-llama/llama-3.3-70b-instruct":{ inputPer1M: 0.60,  outputPer1M: 0.80  },
  "openrouter:anthropic/claude-3.5-sonnet":      { inputPer1M: 3.10,  outputPer1M: 15.50 },
  "openrouter:openai/gpt-4o":                    { inputPer1M: 5.10,  outputPer1M: 15.30 },
};

export function estimateCostUSD(
  provider: ProviderId,
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const key = `${provider}:${model}`;
  const rates = COST_TABLE[key];
  if (!rates) {
    console.warn(`[cost.table] No cost entry for ${key}, using default estimate`);
    return (tokensIn + tokensOut) * 0.000005;
  }
  const inputCost  = (tokensIn  / 1_000_000) * rates.inputPer1M;
  const outputCost = (tokensOut / 1_000_000) * rates.outputPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export { COST_TABLE };