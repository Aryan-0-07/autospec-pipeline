// lib/pipeline/repair/consistency.ts
import type {
  AppSpec,
  DataSchema,
  RepairAttempt,
  ValidationError,
} from "@/lib/types";

// ─────────────────────────────────────────
// Deterministic consistency repairs
// These don't need an AI call — we can fix them programmatically
// ─────────────────────────────────────────

function repairPageEndpointConsistency(spec: AppSpec): string[] {
  const fixes: string[] = [];
  const endpointEntities = new Set(spec.apiEndpoints.map((e) => e.boundEntity));

  for (const page of spec.pages) {
    if (!endpointEntities.has(page.boundEntity)) {
      // Add a minimal GET endpoint for this entity
      spec.apiEndpoints.push({
        path: `/api/${page.boundEntity.toLowerCase()}s`,
        method: "GET",
        handlerDescription: `List all ${page.boundEntity} records`,
        boundEntity: page.boundEntity,
        authRequired: true,
        rateLimitFlag: false,
      });
      endpointEntities.add(page.boundEntity);
      fixes.push(`Added missing GET endpoint for entity "${page.boundEntity}"`);
    }
  }

  return fixes;
}

function repairEntityReferences(
  spec: AppSpec,
  schema: DataSchema
): string[] {
  const fixes: string[] = [];
  const validEntities = new Set(schema.entities.map((e) => e.name));
  const firstEntity = schema.entities[0]?.name ?? "Entity";

  // Fix page boundEntity references
  for (const page of spec.pages) {
    if (!validEntities.has(page.boundEntity)) {
      fixes.push(`Page "${page.name}": replaced unknown entity "${page.boundEntity}" with "${firstEntity}"`);
      page.boundEntity = firstEntity;
    }
  }

  // Fix endpoint boundEntity references
  for (const endpoint of spec.apiEndpoints) {
    if (!validEntities.has(endpoint.boundEntity)) {
      fixes.push(`Endpoint "${endpoint.path}": replaced unknown entity "${endpoint.boundEntity}" with "${firstEntity}"`);
      endpoint.boundEntity = firstEntity;
    }
  }

  // Fix workflowStub trigger entities
  for (const stub of spec.workflowStubs) {
    if (!validEntities.has(stub.trigger.entity)) {
      fixes.push(`WorkflowStub "${stub.name}": replaced unknown entity "${stub.trigger.entity}" with "${firstEntity}"`);
      stub.trigger.entity = firstEntity;
    }
  }

  return fixes;
}

function repairAuthRoles(spec: AppSpec): string[] {
  const fixes: string[] = [];
  const roles = new Set(spec.authRules.roles);

  for (const role of Object.keys(spec.authRules.permissions)) {
    if (!roles.has(role)) {
      // Add the missing role to the roles array
      spec.authRules.roles.push(role);
      roles.add(role);
      fixes.push(`Added missing role "${role}" to authRules.roles`);
    }
  }

  return fixes;
}

function repairIntegrationHooks(spec: AppSpec): string[] {
  const fixes: string[] = [];
  const validIntegrationIds = new Set([
    "slack", "stripe", "whatsapp", "gmail", "webhook",
    "notion", "airtable", "hubspot", "salesforce",
    "jira", "github", "zapier", "twilio", "google_sheets",
  ]);

  const validHooks = spec.integrationHooks.filter((hook) => {
    if (!validIntegrationIds.has(hook.integrationId)) {
      fixes.push(`Removed integrationHook with unknown integrationId "${hook.integrationId}"`);
      return false;
    }
    return true;
  });

  spec.integrationHooks = validHooks;

  const validStubs = spec.workflowStubs.filter((stub) => {
    if (!validIntegrationIds.has(stub.integration)) {
      fixes.push(`Removed workflowStub "${stub.name}" with unknown integration "${stub.integration}"`);
      return false;
    }
    return true;
  });

  spec.workflowStubs = validStubs;

  return fixes;
}

export function tryConsistencyRepair(
  parsed: unknown,
  errors: ValidationError[],
  schema?: DataSchema
): { repaired: boolean; value: unknown; attempt: RepairAttempt } {
  const attempt: RepairAttempt = {
    strategy: "consistency",
    errorInput: errors,
    outcome: "failed",
    detail: "",
    timestamp: new Date().toISOString(),
  };

  const consistencyErrors = errors.filter((e) =>
    e.code === "INVALID_REFERENCE" ||
    e.code === "PAGE_WITHOUT_ENDPOINT" ||
    e.code === "UNKNOWN_ROLE" ||
    e.code === "UNKNOWN_INTEGRATION" ||
    e.code === "UNKNOWN_ACTION" ||
    e.code === "INCONSISTENT_RELATION"
  );

  if (consistencyErrors.length === 0) {
    attempt.outcome = "escalated";
    attempt.detail = "No consistency errors to repair — escalating";
    return { repaired: false, value: parsed, attempt };
  }

  try {
    const fixed = JSON.parse(JSON.stringify(parsed)) as AppSpec;
    const allFixes: string[] = [];

    // Apply deterministic repairs in order
    allFixes.push(...repairPageEndpointConsistency(fixed));
    if (schema) allFixes.push(...repairEntityReferences(fixed, schema));
    allFixes.push(...repairAuthRoles(fixed));
    allFixes.push(...repairIntegrationHooks(fixed));

    if (allFixes.length === 0) {
      attempt.outcome = "escalated";
      attempt.detail = "Consistency errors present but no deterministic fix available — escalating to re-prompt";
      return { repaired: false, value: fixed, attempt };
    }

    attempt.outcome = "repaired";
    attempt.detail = allFixes.join("; ");
    return { repaired: true, value: fixed, attempt };

  } catch (err) {
    attempt.outcome = "failed";
    attempt.detail = `Consistency repair failed: ${err instanceof Error ? err.message : String(err)}`;
    return { repaired: false, value: parsed, attempt };
  }
}