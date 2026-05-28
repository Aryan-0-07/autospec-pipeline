// lib/pipeline/validation/validator.ts
import type {
  AppIntent,
  AppSpec,
  DataSchema,
  ValidationError,
  ValidationResult,
} from "@/lib/types";
import { ZodError } from "zod";
import { AppIntentSchema, AppSpecSchema, DataSchemaSchema } from "./schemas";
import { isValidAction, isValidIntegration } from "@/lib/pipeline/integrations/registry";

// ─────────────────────────────────────────
// Convert Zod errors to our ValidationError format
// ─────────────────────────────────────────

function fromZodError(error: ZodError): ValidationError[] {
  return error.issues.map((e) => ({
    code: "MISSING_FIELD" as const,
    field: e.path.join("."),
    message: e.message,
    context: { zodCode: e.code },
  }));
}

// ─────────────────────────────────────────
// Stage 1 validator
// ─────────────────────────────────────────

export function validateAppIntent(data: unknown): ValidationResult {
  const result = AppIntentSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: fromZodError(result.error) };
  }
  return { valid: true, errors: [] };
}

// ─────────────────────────────────────────
// Stage 2 validator
// ─────────────────────────────────────────

export function validateDataSchema(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Zod structure check
  const result = DataSchemaSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: fromZodError(result.error) };
  }

  const schema = result.data as DataSchema;
  const entityNames = new Set(schema.entities.map((e) => e.name));

  for (const entity of schema.entities) {
    // 2. Every entity must have a tenantId field
    const hasTenantId = entity.fields.some((f) => f.name === "tenantId");
    if (!hasTenantId) {
      errors.push({
        code: "MISSING_TENANT_ID",
        field: `${entity.name}.fields`,
        message: `Entity "${entity.name}" is missing required tenantId field`,
      });
    }

    // 3. Relation targets must resolve to known entities
    for (const relation of entity.relations) {
      if (!entityNames.has(relation.target)) {
        errors.push({
          code: "INVALID_REFERENCE",
          field: `${entity.name}.relations`,
          message: `Relation target "${relation.target}" does not exist in schema`,
          context: { source: entity.name, target: relation.target },
        });
      }
    }
  }

  // 4. Bidirectional relation check
  for (const entity of schema.entities) {
    for (const relation of entity.relations) {
      if (!entityNames.has(relation.target)) continue;

      const targetEntity = schema.entities.find(
        (e) => e.name === relation.target
      );
      if (!targetEntity) continue;

      // hasMany on A must have a matching belongsTo on B
      if (relation.type === "hasMany") {
        const hasReverse = targetEntity.relations.some(
          (r) => r.type === "belongsTo" && r.target === entity.name
        );
        if (!hasReverse) {
          errors.push({
            code: "INCONSISTENT_RELATION",
            field: `${entity.name}.relations`,
            message: `"${entity.name}" hasMany "${relation.target}" but "${relation.target}" has no belongsTo "${entity.name}"`,
            context: { source: entity.name, target: relation.target },
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────
// Stage 3 validator
// ─────────────────────────────────────────

export function validateAppSpec(
  data: unknown,
  schema: DataSchema
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Zod structure check
  const result = AppSpecSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: fromZodError(result.error) };
  }

  const spec = result.data as AppSpec;
  const entityNames = new Set(schema.entities.map((e) => e.name));
  const endpointEntities = new Set(spec.apiEndpoints.map((e) => e.boundEntity));

  // 2. Every page must have a corresponding API endpoint
  for (const page of spec.pages) {
    const hasEndpoint = spec.apiEndpoints.some(
      (ep) => ep.boundEntity === page.boundEntity
    );
    if (!hasEndpoint) {
      errors.push({
        code: "PAGE_WITHOUT_ENDPOINT",
        field: `pages.${page.name}`,
        message: `Page "${page.name}" has no corresponding API endpoint for entity "${page.boundEntity}"`,
      });
    }

    // 3. Page boundEntity must exist in DataSchema
    if (!entityNames.has(page.boundEntity)) {
      errors.push({
        code: "INVALID_REFERENCE",
        field: `pages.${page.name}.boundEntity`,
        message: `Page "${page.name}" references unknown entity "${page.boundEntity}"`,
      });
    }
  }

  // 4. API endpoint boundEntity must exist in DataSchema
  for (const endpoint of spec.apiEndpoints) {
    if (!entityNames.has(endpoint.boundEntity)) {
      errors.push({
        code: "INVALID_REFERENCE",
        field: `apiEndpoints.${endpoint.path}`,
        message: `Endpoint "${endpoint.path}" references unknown entity "${endpoint.boundEntity}"`,
      });
    }
  }

  // 5. Auth rules — permissions must only reference known roles
  const roles = new Set(spec.authRules.roles);
  for (const role of Object.keys(spec.authRules.permissions)) {
    if (!roles.has(role)) {
      errors.push({
        code: "UNKNOWN_ROLE",
        field: `authRules.permissions.${role}`,
        message: `Permission references unknown role "${role}"`,
      });
    }
  }

  // 6. WorkflowStub trigger entity must exist in DataSchema
  for (const stub of spec.workflowStubs) {
    if (!entityNames.has(stub.trigger.entity)) {
      errors.push({
        code: "INVALID_REFERENCE",
        field: `workflowStubs.${stub.name}.trigger.entity`,
        message: `WorkflowStub "${stub.name}" references unknown entity "${stub.trigger.entity}"`,
      });
    }
  }

  // Validate integrationHooks against registry
  for (const hook of spec.integrationHooks) {
    if (!isValidIntegration(hook.integrationId)) {
      errors.push({
        code: "UNKNOWN_INTEGRATION",
        field: `integrationHooks.${hook.integrationId}`,
        message: `Integration "${hook.integrationId}" is not in the registry`,
      });
    } else if (!isValidAction(hook.integrationId, hook.actionId)) {
      errors.push({
        code: "UNKNOWN_ACTION",
        field: `integrationHooks.${hook.integrationId}.${hook.actionId}`,
        message: `Action "${hook.actionId}" does not exist in integration "${hook.integrationId}"`,
      });
    }
  }

  return { valid: errors.length === 0, errors };

  // Validate integrationHooks against registry
  for (const hook of spec.integrationHooks) {
    if (!isValidIntegration(hook.integrationId)) {
      errors.push({
        code: "UNKNOWN_INTEGRATION",
        field: `integrationHooks.${hook.integrationId}`,
        message: `Integration "${hook.integrationId}" is not in the registry`,
      });
    } else if (!isValidAction(hook.integrationId, hook.actionId)) {
      errors.push({
        code: "UNKNOWN_ACTION",
        field: `integrationHooks.${hook.integrationId}.${hook.actionId}`,
        message: `Action "${hook.actionId}" does not exist in integration "${hook.integrationId}"`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}