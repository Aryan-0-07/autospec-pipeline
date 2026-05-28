// lib/pipeline/repair/field.ts
import type { RepairAttempt, ValidationError, ValidationErrorCode } from "@/lib/types";

// Default values for each field type
const FIELD_DEFAULTS: Record<string, unknown> = {
  string:   "",
  number:   0,
  boolean:  false,
  array:    [],
  object:   {},
  uuid:     "00000000-0000-0000-0000-000000000000",
};

// Known required fields and their defaults for each stage output
const STAGE_FIELD_DEFAULTS: Record<string, unknown> = {
  // AppIntent defaults
  appName:                 "Unnamed App",
  appType:                 "custom",
  features:                [],
  entities:                [],
  integrations_requested:  [],
  assumptions:             [],

  // EntitySchema defaults
  tableName:               "unknown_table",
  fields:                  [],
  relations:               [],

  // PageSpec defaults
  route:                   "/",
  layout:                  "list",
  components:              ["table"],

  // ApiEndpoint defaults
  method:                  "GET",
  handlerDescription:      "Handles requests",
  authRequired:            true,
  rateLimitFlag:           false,

  // AuthRules defaults
  roles:                   ["admin", "user"],
  permissions:             {},
};

function getDefaultForField(fieldName: string): unknown {
  const knownDefault = STAGE_FIELD_DEFAULTS[fieldName];
  if (knownDefault !== undefined) return knownDefault;
  return FIELD_DEFAULTS["string"];
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key === undefined) break;
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = path[path.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
}

const REPAIRABLE_CODES: ValidationErrorCode[] = [
  "MISSING_FIELD",
  "WRONG_TYPE",
];

export function tryFieldRepair(
  parsed: unknown,
  errors: ValidationError[]
): { repaired: boolean; value: unknown; attempt: RepairAttempt } {
  const attempt: RepairAttempt = {
    strategy: "field",
    errorInput: errors,
    outcome: "failed",
    detail: "",
    timestamp: new Date().toISOString(),
  };

  const fieldErrors = errors.filter((e) =>
    REPAIRABLE_CODES.includes(e.code)
  );

  if (fieldErrors.length === 0) {
    attempt.outcome = "escalated";
    attempt.detail = "No field-level errors to repair — escalating";
    return { repaired: false, value: parsed, attempt };
  }

  try {
    const fixed = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
    const repairedFields: string[] = [];

    for (const error of fieldErrors) {
      const path = error.field.split(".");
      const fieldName = path[path.length - 1] ?? error.field;
      const defaultValue = getDefaultForField(fieldName);

      setNestedValue(fixed, path, defaultValue);
      repairedFields.push(`${error.field} → ${JSON.stringify(defaultValue)}`);
    }

    attempt.outcome = "repaired";
    attempt.detail = `Injected defaults for: ${repairedFields.join(", ")}`;
    return { repaired: true, value: fixed, attempt };

  } catch (err) {
    attempt.outcome = "failed";
    attempt.detail = `Field repair failed: ${err instanceof Error ? err.message : String(err)}`;
    return { repaired: false, value: parsed, attempt };
  }
}