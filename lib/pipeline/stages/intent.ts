// lib/pipeline/stages/intent.ts
import type {
  AppIntent,
  GatewayOptions,
  PipelineStage,
  StageCost,
  ValidationResult,
} from "@/lib/types";
import { callModel, parseJSON } from "@/lib/pipeline/gateway/gateway";
import { validateAppIntent } from "@/lib/pipeline/validation/validator";

const STAGE: PipelineStage = "intent_extraction";

const SYSTEM_PROMPT = `You are a precise JSON generator for an app-building platform.
Your job is to extract structured intent from a natural language app description.
Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

function buildPrompt(userPrompt: string): string {
  const wordCount = userPrompt.trim().split(/\s+/).length;
  const isVague = wordCount < 10;

  // Count commas+features to detect overscoped prompts
  const featureCount = (userPrompt.match(/,/g) ?? []).length;
  const isOverscoped = featureCount >= 4 || wordCount > 30;

  return `Extract the app intent from this description and return a JSON object.

User description: "${userPrompt}"

${isVague ? `NOTE: This description is very short. Add at least 3 specific assumptions about what this app does. Do NOT return clarification_required — proceed with assumptions.` : ""}

${isOverscoped ? `NOTE: This prompt is overscoped for an MVP. You MUST reduce to the 3-4 most core entities only. Document what was cut in the assumptions array. Pick ONE primary appType that best fits.` : ""}

Return this exact JSON structure:
{
  "appName": "string",
  "appType": "crm | project_management | ecommerce | hr_tool | inventory | content_platform | analytics | custom",
  "features": ["maximum 5 core features only"],
  "entities": ["maximum 4 core entities in PascalCase — no more"],
  "integrations_requested": ["lowercase integration names or empty array"],
  "assumptions": ["document any cuts, simplifications, or assumptions made"],
  "clarification_required": null
}

Rules:
- appType must be exactly one of the enum values
- entities must be PascalCase nouns — MAXIMUM 4 entities
- features — MAXIMUM 5 items
- integrations_requested must be lowercase
- Set clarification_required to null
- Return ONLY the JSON object`;
}

export interface IntentStageResult {
  intent: AppIntent;
  validation: ValidationResult;
  cost: StageCost;
  retryCount: number;
}

export async function runIntentExtraction(
  userPrompt: string,
  options?: GatewayOptions
): Promise<IntentStageResult> {
  let retryCount = 0;
  let lastValidation: ValidationResult = { valid: false, errors: [] };
  let lastCost: StageCost | null = null;

  const prompt = buildPrompt(userPrompt);

  // Attempt 1 — normal call
  try {
    const { response, cost } = await callModel(STAGE, prompt, {
      ...options,
      systemPrompt: SYSTEM_PROMPT,
    });
    lastCost = cost;

    let parsed: unknown;
    try {
      parsed = parseJSON(response.content);
    } catch {
      // JSON parse failed — attempt repair prompt once
      retryCount++;
      const repairPrompt = `The following is not valid JSON. Extract and fix it, return ONLY the corrected JSON object:

${response.content}`;

      const { response: repairResponse, cost: repairCost } = await callModel(
        STAGE,
        repairPrompt,
        { ...options, systemPrompt: SYSTEM_PROMPT }
      );
      lastCost = repairCost;
      parsed = parseJSON(repairResponse.content);
    }

    // Remove null clarification_required before validation
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "clarification_required" in parsed &&
      (parsed as Record<string, unknown>).clarification_required === null
    ) {
      delete (parsed as Record<string, unknown>).clarification_required;
    }

    lastValidation = validateAppIntent(parsed);

    if (lastValidation.valid) {
      return {
        intent: parsed as AppIntent,
        validation: lastValidation,
        cost: lastCost,
        retryCount,
      };
    }

    // Validation failed — one targeted retry
    retryCount++;
    const validationErrors = lastValidation.errors
      .map((e) => `- ${e.field}: ${e.message}`)
      .join("\n");

    const fixPrompt = `Your previous response had these validation errors:
${validationErrors}

Original user description: "${userPrompt}"

Fix ALL errors and return ONLY the corrected JSON object with this structure:
{
  "appName": "string",
  "appType": "crm | project_management | ecommerce | hr_tool | inventory | content_platform | analytics | custom",
  "features": ["..."],
  "entities": ["..."],
  "integrations_requested": ["..."],
  "assumptions": ["..."]
}`;

    const { response: fixResponse, cost: fixCost } = await callModel(
      STAGE,
      fixPrompt,
      { ...options, systemPrompt: SYSTEM_PROMPT }
    );
    lastCost = fixCost;

    const fixedParsed = parseJSON(fixResponse.content) as Record<string, unknown>;
    if (fixedParsed.clarification_required === null) {
      delete fixedParsed.clarification_required;
    }

    lastValidation = validateAppIntent(fixedParsed);

    return {
      intent: fixedParsed as unknown as AppIntent,
      validation: lastValidation,
      cost: lastCost,
      retryCount,
    };

  } catch (error) {
    throw new Error(
      `[intent_extraction] Stage failed after ${retryCount} retries: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}