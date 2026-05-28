// lib/pipeline/repair/structural.ts
import type { RepairAttempt, ValidationError } from "@/lib/types";

// ─────────────────────────────────────────
// Attempt to extract valid JSON from a broken string
// Handles: trailing text, truncated objects, extra commas
// ─────────────────────────────────────────

function extractJSON(raw: string): string {
  // Strip markdown fences
  let cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Find the first { or [ and last } or ]
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  let start = -1;
  let isObject = true;

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error("No JSON structure found in response");
  }

  if (firstBrace === -1) { start = firstBracket; isObject = false; }
  else if (firstBracket === -1) { start = firstBrace; isObject = true; }
  else if (firstBrace < firstBracket) { start = firstBrace; isObject = true; }
  else { start = firstBracket; isObject = false; }

  const openChar  = isObject ? "{" : "[";
  const closeChar = isObject ? "}" : "]";

  // Walk the string tracking brace depth
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) {
    // Truncated — close all open braces
    const unclosed = depth;
    let partial = cleaned.slice(start);
    // Remove trailing comma before closing
    partial = partial.replace(/,\s*$/, "");
    partial += closeChar.repeat(unclosed);
    return partial;
  }

  return cleaned.slice(start, end + 1);
}

function removeTrailingCommas(json: string): string {
  return json
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]");
}

export function tryStructuralRepair(
  raw: string,
  errors: ValidationError[]
): { repaired: boolean; value: string; attempt: RepairAttempt } {
  const attempt: RepairAttempt = {
    strategy: "structural",
    errorInput: errors,
    outcome: "failed",
    detail: "",
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: extract JSON boundaries
    const extracted = extractJSON(raw);

    // Step 2: remove trailing commas
    const cleaned = removeTrailingCommas(extracted);

    // Step 3: verify it parses
    JSON.parse(cleaned);

    attempt.outcome = "repaired";
    attempt.detail = "Extracted valid JSON boundaries and removed trailing commas";
    return { repaired: true, value: cleaned, attempt };

  } catch (err) {
    attempt.outcome = "failed";
    attempt.detail = `Structural repair failed: ${err instanceof Error ? err.message : String(err)}`;
    return { repaired: false, value: raw, attempt };
  }
}