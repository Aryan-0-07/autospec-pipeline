// lib/pipeline/repair/engine.ts
import type {
  AppSpec,
  DataSchema,
  PipelineStage,
  RepairAttempt,
  ValidationError,
  ValidationResult,
} from "@/lib/types";
import { callModel, parseJSON } from "@/lib/pipeline/gateway/gateway";
import { getRepairConfig } from "@/lib/config/routing.config";
import { validateAppIntent, validateAppSpec, validateDataSchema } from "@/lib/pipeline/validation/validator";
import { tryStructuralRepair } from "./structural";
import { tryFieldRepair } from "./field";
import { tryConsistencyRepair } from "./consistency";

export interface RepairResult {
  success: boolean;
  value: unknown;
  log: RepairAttempt[];
}

// ─────────────────────────────────────────
// Run the right validator for each stage
// ─────────────────────────────────────────

function runValidator(
  stage: PipelineStage,
  value: unknown,
  schema?: DataSchema
): ValidationResult {
  switch (stage) {
    case "intent_extraction":
      return validateAppIntent(value);
    case "schema_generation":
      return validateDataSchema(value);
    case "appspec_generation":
      return validateAppSpec(value, schema ?? { entities: [] });
    default:
      return { valid: true, errors: [] };
  }
}

// ─────────────────────────────────────────
// Main repair engine
// ─────────────────────────────────────────

export async function runRepairEngine(
  stage: PipelineStage,
  rawOutput: string,
  validationErrors: ValidationError[],
  failedProvider: string,
  failedModel: string,
  schema?: DataSchema
): Promise<RepairResult> {
  const log: RepairAttempt[] = [];
  let currentRaw = rawOutput;
  let currentParsed: unknown = null;

  console.log(`[repair] Starting repair for stage=${stage} errors=${validationErrors.length}`);

  // ── Strategy 1: Structural repair (JSON parsing issues) ──
  const hasMalformedJSON =
    validationErrors.some((e) => e.code === "MALFORMED_JSON") ||
    (() => {
      try { JSON.parse(currentRaw); return false; }
      catch { return true; }
    })();

  if (hasMalformedJSON) {
    const structural = tryStructuralRepair(currentRaw, validationErrors);
    log.push(structural.attempt);
    console.log(`[repair] structural: ${structural.attempt.outcome} — ${structural.attempt.detail}`);

    if (structural.repaired) {
      try {
        currentParsed = JSON.parse(structural.value);
        const validation = runValidator(stage, currentParsed, schema);
        if (validation.valid) {
          return { success: true, value: currentParsed, log };
        }
        // Structural repair succeeded but other errors remain — continue
        validationErrors = validation.errors;
      } catch {
        // Still not parseable — continue to next strategy
      }
    }
  } else {
    try {
      currentParsed = JSON.parse(currentRaw);
    } catch {
      currentParsed = null;
    }
  }

  // ── Strategy 2: Field repair (missing/wrong-typed fields) ──
  if (currentParsed !== null) {
    const field = tryFieldRepair(currentParsed, validationErrors);
    log.push(field.attempt);
    console.log(`[repair] field: ${field.attempt.outcome} — ${field.attempt.detail}`);

    if (field.repaired) {
      const validation = runValidator(stage, field.value, schema);
      if (validation.valid) {
        return { success: true, value: field.value, log };
      }
      currentParsed = field.value;
      validationErrors = validation.errors;
    }
  }

  // ── Strategy 3: Consistency repair (cross-layer references) ──
  if (currentParsed !== null && stage === "appspec_generation") {
    const consistency = tryConsistencyRepair(currentParsed, validationErrors, schema);
    log.push(consistency.attempt);
    console.log(`[repair] consistency: ${consistency.attempt.outcome} — ${consistency.attempt.detail}`);

    if (consistency.repaired) {
      const validation = runValidator(stage, consistency.value, schema);
      if (validation.valid) {
        return { success: true, value: consistency.value, log };
      }
      currentParsed = consistency.value;
      validationErrors = validation.errors;
    }
  }

  // ── Escalation: targeted re-prompt with the same model ──
  console.log(`[repair] All strategies exhausted — escalating to re-prompt`);

  const escalationAttempt: RepairAttempt = {
    strategy: "consistency",
    errorInput: validationErrors,
    outcome: "escalated",
    detail: "All deterministic strategies failed — sending targeted correction prompt",
    timestamp: new Date().toISOString(),
  };

  try {
    const repairConfig = getRepairConfig(
      failedProvider as Parameters<typeof getRepairConfig>[0],
      failedModel
    );

    const errorList = validationErrors
      .map((e) => `- [${e.code}] ${e.field}: ${e.message}`)
      .join("\n");

    const repairPrompt = `The following JSON output failed validation with these errors:

${errorList}

Current output:
${JSON.stringify(currentParsed ?? currentRaw, null, 2)}

Fix ALL validation errors and return ONLY the corrected JSON object.
Do not add explanation or markdown.`;

    const { response } = await callModel("repair", repairPrompt, {
      forceProvider: repairConfig.provider,
      systemPrompt: "You are a precise JSON repair engine. Return only valid JSON.",
    });

    const repairedValue = parseJSON(response.content);
    const finalValidation = runValidator(stage, repairedValue, schema);

    if (finalValidation.valid) {
      escalationAttempt.outcome = "repaired";
      escalationAttempt.detail = "Re-prompt succeeded after strategy exhaustion";
      log.push(escalationAttempt);
      return { success: true, value: repairedValue, log };
    }

    escalationAttempt.outcome = "failed";
    escalationAttempt.detail = `Re-prompt failed: ${finalValidation.errors.map((e) => e.message).join(", ")}`;
    log.push(escalationAttempt);
    return { success: false, value: currentParsed, log };

  } catch (err) {
    escalationAttempt.outcome = "failed";
    escalationAttempt.detail = `Re-prompt threw error: ${err instanceof Error ? err.message : String(err)}`;
    log.push(escalationAttempt);
    return { success: false, value: currentParsed, log };
  }
}