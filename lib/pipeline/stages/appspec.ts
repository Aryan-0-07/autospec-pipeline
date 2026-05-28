// lib/pipeline/stages/appspec.ts
import type { AppIntent, AppSpec, DataSchema, GatewayOptions, PipelineStage, StageCost, ValidationResult } from "@/lib/types";
import { callModel, parseJSON } from "@/lib/pipeline/gateway/gateway";
import { validateAppSpec } from "@/lib/pipeline/validation/validator";

const STAGE: PipelineStage = "appspec_generation";
const SYSTEM_PROMPT = `You are a precise app specification generator. Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

function buildPrompt(schema: DataSchema, intent: AppIntent): string {
  const limitedEntities = schema.entities.slice(0, 4);
  const entityNames = limitedEntities.map((e) => e.name).join(", ");
  const integrations = intent.integrations_requested.slice(0, 2).join(", ") || "none";

  return `Generate a complete app specification. Return ONLY a JSON object, no markdown.

App: ${intent.appName} (${intent.appType})
Entities available (use EXACTLY these names): ${entityNames}
Integrations requested: ${integrations}

Return this exact JSON structure with ALL fields filled:
{
  "pages": [
    {
      "name": "Dashboard",
      "route": "/dashboard",
      "layout": "dashboard",
      "boundEntity": "${limitedEntities[0]?.name ?? "Entity"}",
      "components": ["table"]
    },
    {
      "name": "${limitedEntities[0]?.name ?? "Entity"} List",
      "route": "/${(limitedEntities[0]?.name ?? "entity").toLowerCase()}s",
      "layout": "list",
      "boundEntity": "${limitedEntities[0]?.name ?? "Entity"}",
      "components": ["table", "form"]
    }
  ],
  "apiEndpoints": [
    {
      "path": "/api/${(limitedEntities[0]?.name ?? "entity").toLowerCase()}s",
      "method": "GET",
      "handlerDescription": "List all ${limitedEntities[0]?.name ?? "Entity"} records",
      "boundEntity": "${limitedEntities[0]?.name ?? "Entity"}",
      "authRequired": true,
      "rateLimitFlag": false
    },
    {
      "path": "/api/${(limitedEntities[0]?.name ?? "entity").toLowerCase()}s",
      "method": "POST",
      "handlerDescription": "Create a new ${limitedEntities[0]?.name ?? "Entity"}",
      "boundEntity": "${limitedEntities[0]?.name ?? "Entity"}",
      "authRequired": true,
      "rateLimitFlag": false
    }
  ],
  "authRules": {
    "roles": ["admin", "user"],
    "permissions": {
      "admin": {
        "${limitedEntities[0]?.name ?? "Entity"}": ["read", "write", "delete"]
      },
      "user": {
        "${limitedEntities[0]?.name ?? "Entity"}": ["read", "write"]
      }
    }
  },
  "integrationHooks": [
    {
      "integrationId": "webhook",
      "actionId": "post_payload",
      "triggerEntity": "${limitedEntities[0]?.name ?? "Entity"}",
      "triggerEvent": "created",
      "condition": ""
    }
  ],
  "workflowStubs": [
    {
      "name": "Notify on record created",
      "trigger": {
        "entity": "${limitedEntities[0]?.name ?? "Entity"}",
        "event": "created"
      },
      "integration": "webhook",
      "action": "post_payload",
      "payload": [
        { "sourceField": "id", "targetParam": "recordId" }
      ]
    }
  ]
}

STRICT RULES:
1. "route" must start with "/" — e.g. "/leads", "/dashboard"
2. "layout" must be exactly one of: "list" | "detail" | "dashboard" | "settings"
3. "components" must be a non-empty array — e.g. ["table"] or ["form", "card"]
4. "method" must be exactly one of: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
5. "permissions" must be a nested object like { "admin": { "EntityName": ["read","write","delete"] } }
6. "integrationHooks" and "workflowStubs" must be arrays
7. "triggerEvent" must be one of: "created" | "updated" | "deleted" | "status_changed"
8. "integrationId" must be one of: slack | stripe | whatsapp | gmail | webhook
9. Every page MUST have a matching apiEndpoint with the same boundEntity
10. Only use these entity names: ${entityNames}
11. Maximum 4 pages and 6 endpoints total
12. Return ONLY the JSON object, no explanation`;
}

const VALID_LAYOUTS = ["list", "detail", "dashboard", "settings"];
const VALID_COMPONENTS = ["table", "form", "chart", "card"];
const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const VALID_EVENTS = ["created", "updated", "deleted", "status_changed"];

function sanitizeAppSpec(parsed: unknown, schema: DataSchema): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const spec = parsed as Record<string, unknown>;

  const firstEntity = schema.entities[0]?.name ?? "Entity";
  const validEntities = new Set(schema.entities.map((e) => e.name));

  if (!Array.isArray(spec.pages)) spec.pages = [];
  if (!Array.isArray(spec.apiEndpoints)) spec.apiEndpoints = [];
  if (!Array.isArray(spec.integrationHooks)) spec.integrationHooks = [];
  if (!Array.isArray(spec.workflowStubs)) spec.workflowStubs = [];

  // Ensure authRules exists
  if (!spec.authRules || typeof spec.authRules !== "object") {
    spec.authRules = { roles: ["admin", "user"], permissions: {} };
  }
  const authRules = spec.authRules as Record<string, unknown>;

  // Ensure roles is a non-empty array
  if (!Array.isArray(authRules.roles) || (authRules.roles as unknown[]).length === 0) {
    authRules.roles = ["admin", "user"];
  }

  // Ensure permissions is a properly nested object
  if (
    !authRules.permissions ||
    Array.isArray(authRules.permissions) ||
    typeof authRules.permissions !== "object"
  ) {
    const roles = authRules.roles as string[];
    const defaultPerms: Record<string, Record<string, string[]>> = {};
    for (const role of roles) {
      defaultPerms[role] = {};
      for (const entity of schema.entities.slice(0, 4)) {
        defaultPerms[role][entity.name] = role === "admin"
          ? ["read", "write", "delete"]
          : ["read", "write"];
      }
    }
    authRules.permissions = defaultPerms;
  } else {
    const perms = authRules.permissions as Record<string, unknown>;
    for (const role of Object.keys(perms)) {
      if (typeof perms[role] !== "object" || Array.isArray(perms[role])) {
        const defaultEntityPerms: Record<string, string[]> = {};
        for (const entity of schema.entities.slice(0, 4)) {
          defaultEntityPerms[entity.name] = role === "admin"
            ? ["read", "write", "delete"]
            : ["read", "write"];
        }
        perms[role] = defaultEntityPerms;
      }
    }
  }

  // Fix each page
  spec.pages = (spec.pages as Record<string, unknown>[]).slice(0, 6).map((page) => {
    const name = String(page.name ?? "page");

    let route = page.route;
    if (
      typeof route !== "string" ||
      !route.startsWith("/") ||
      route === "/page" ||
      route === "/pages" ||
      route.trim() === "/"
    ) {
      const entitySlug = (
        typeof page.boundEntity === "string" && page.boundEntity.trim().length > 0
          ? page.boundEntity
          : name
      ).toLowerCase().replace(/\s+/g, "-");
      route = `/${entitySlug}s`;
    }

    let layout = page.layout;
    if (!VALID_LAYOUTS.includes(layout as string)) layout = "list";

    let components = page.components;
    if (Array.isArray(components)) {
      components = (components as unknown[]).filter((c) =>
        VALID_COMPONENTS.includes(c as string)
      );
    }
    if (!Array.isArray(components) || (components as unknown[]).length === 0) {
      components = ["table"];
    }

    let boundEntity = page.boundEntity;
    if (typeof boundEntity !== "string" || boundEntity.trim().length === 0) {
      boundEntity = firstEntity;
    } else if (!validEntities.has(boundEntity as string)) {
      boundEntity = firstEntity;
    }

    return { ...page, route, layout, components, boundEntity };
  });

  // Fix each apiEndpoint
  spec.apiEndpoints = (spec.apiEndpoints as Record<string, unknown>[]).slice(0, 8).map((ep) => {
    let method = ep.method;
    if (!VALID_METHODS.includes(method as string)) method = "GET";

    let path = ep.path;
    if (typeof path !== "string" || !path.startsWith("/")) {
      path = `/api/${String(ep.boundEntity ?? "data").toLowerCase()}s`;
    }

    let boundEntity = ep.boundEntity;
    if (typeof boundEntity !== "string" || boundEntity.trim().length === 0) {
      boundEntity = firstEntity;
    } else if (!validEntities.has(boundEntity as string)) {
      boundEntity = firstEntity;
    }

    const handlerDescription =
      typeof ep.handlerDescription === "string" && ep.handlerDescription.trim().length > 0
        ? ep.handlerDescription
        : `Handle ${method} request for ${boundEntity}`;

    return { ...ep, method, path, boundEntity, handlerDescription };
  });

  // Fix integrationHooks
  spec.integrationHooks = (spec.integrationHooks as Record<string, unknown>[])
    .filter((hook) => typeof hook === "object" && hook !== null)
    .map((hook) => {
      if (typeof hook.integrationId !== "string" || hook.integrationId.trim().length === 0) {
        hook.integrationId = "webhook";
      }
      if (typeof hook.actionId !== "string" || hook.actionId.trim().length === 0) {
        hook.actionId = "post_payload";
      }
      if (typeof hook.triggerEntity !== "string" || hook.triggerEntity.trim().length === 0) {
        hook.triggerEntity = firstEntity;
      }
      if (!validEntities.has(hook.triggerEntity as string)) {
        hook.triggerEntity = firstEntity;
      }
      if (!VALID_EVENTS.includes(hook.triggerEvent as string)) {
        hook.triggerEvent = "created";
      }
      // Ensure condition is always a string, never undefined
      if (typeof hook.condition !== "string") {
        hook.condition = "";
      }
      return hook;
    });

  // Fix workflowStubs
  spec.workflowStubs = (spec.workflowStubs as Record<string, unknown>[])
    .filter((stub) => typeof stub === "object" && stub !== null)
    .map((stub) => {
      if (typeof stub.name !== "string" || stub.name.trim().length === 0) {
        stub.name = "Workflow stub";
      }
      if (typeof stub.integration !== "string" || stub.integration.trim().length === 0) {
        stub.integration = "webhook";
      }
      if (typeof stub.action !== "string" || stub.action.trim().length === 0) {
        stub.action = "post_payload";
      }
      if (!Array.isArray(stub.payload)) {
        stub.payload = [];
      }
      // Fix each payload field
      stub.payload = (stub.payload as Record<string, unknown>[]).map((p) => ({
        sourceField: typeof p.sourceField === "string" && p.sourceField.trim().length > 0
          ? p.sourceField : "id",
        targetParam: typeof p.targetParam === "string" && p.targetParam.trim().length > 0
          ? p.targetParam : "recordId",
      }));

      if (!stub.trigger || typeof stub.trigger !== "object") {
        stub.trigger = { entity: firstEntity, event: "created" };
      }
      const trigger = stub.trigger as Record<string, unknown>;
      if (typeof trigger.entity !== "string" || trigger.entity.trim().length === 0) {
        trigger.entity = firstEntity;
      }
      if (!validEntities.has(trigger.entity as string)) {
        trigger.entity = firstEntity;
      }
      if (!VALID_EVENTS.includes(trigger.event as string)) {
        trigger.event = "created";
      }
      // Ensure condition is always a string, never undefined
      if (typeof trigger.condition !== "string") {
        trigger.condition = "";
      }
      return stub;
    });

  // Ensure at least one page
  if ((spec.pages as unknown[]).length === 0) {
    spec.pages = [{
      name: "Dashboard",
      route: "/dashboard",
      layout: "dashboard",
      boundEntity: firstEntity,
      components: ["table"],
    }];
  }

  // Ensure at least one endpoint
  if ((spec.apiEndpoints as unknown[]).length === 0) {
    spec.apiEndpoints = [{
      path: `/api/${firstEntity.toLowerCase()}s`,
      method: "GET",
      handlerDescription: `List all ${firstEntity} records`,
      boundEntity: firstEntity,
      authRequired: true,
      rateLimitFlag: false,
    }];
  }

  return spec;
}

export interface AppSpecStageResult {
  appSpec: AppSpec;
  validation: ValidationResult;
  cost: StageCost;
  retryCount: number;
}

export async function runAppSpecGeneration(
  schema: DataSchema, intent: AppIntent, options?: GatewayOptions
): Promise<AppSpecStageResult> {
  let retryCount = 0;
  let lastCost: StageCost | null = null;

  try {
    const { response, cost } = await callModel(STAGE, buildPrompt(schema, intent), { ...options, systemPrompt: SYSTEM_PROMPT });
    lastCost = cost;

    let parsed: unknown;
    try {
      parsed = parseJSON(response.content);
    } catch {
      retryCount++;
      const { response: r, cost: c } = await callModel(
        STAGE,
        `Fix this invalid JSON, return ONLY corrected JSON:\n\n${response.content}`,
        { ...options, systemPrompt: SYSTEM_PROMPT }
      );
      lastCost = c;
      parsed = parseJSON(r.content);
    }

    parsed = sanitizeAppSpec(parsed, schema);

    let validation = validateAppSpec(parsed, schema);
    if (validation.valid) return { appSpec: parsed as AppSpec, validation, cost: lastCost, retryCount };

    retryCount++;
    const entityNameList = schema.entities.slice(0, 4).map((e) => e.name).join(", ");
    const validationErrors = validation.errors.map((e) => `- ${e.field}: ${e.message}`).join("\n");
    const fixPrompt = `Your AppSpec had these errors:\n${validationErrors}\n\nFix ALL errors. Only use these entities: ${entityNameList}.\n\nRules:\n- route must start with "/"\n- layout must be one of: list | detail | dashboard | settings\n- components must be a non-empty array like ["table"]\n- method must be one of: GET | POST | PUT | PATCH | DELETE\n- permissions must be nested object: { "admin": { "EntityName": ["read","write","delete"] } }\n- integrationHooks and workflowStubs must be arrays\n- triggerEvent must be one of: created | updated | deleted | status_changed\n- Every page needs a matching API endpoint\n- Maximum 4 pages, 6 endpoints\n\nReturn ONLY the corrected JSON object.`;

    const { response: fixResponse, cost: fixCost } = await callModel(
      STAGE,
      fixPrompt,
      { ...options, systemPrompt: SYSTEM_PROMPT }
    );
    lastCost = fixCost;

    const fixed = sanitizeAppSpec(parseJSON(fixResponse.content), schema);
    validation = validateAppSpec(fixed, schema);
    return { appSpec: fixed as AppSpec, validation, cost: lastCost, retryCount };

  } catch (error) {
    throw new Error(
      `[appspec_generation] Stage failed after ${retryCount} retries: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}