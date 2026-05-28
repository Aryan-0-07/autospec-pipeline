// lib/pipeline/stages/schema.ts
import type { AppIntent, DataSchema, GatewayOptions, PipelineStage, StageCost, ValidationResult } from "@/lib/types";
import { callModel, parseJSON } from "@/lib/pipeline/gateway/gateway";
import { validateDataSchema } from "@/lib/pipeline/validation/validator";

const STAGE: PipelineStage = "schema_generation";
const SYSTEM_PROMPT = `You are a precise database schema generator. Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

function buildPrompt(intent: AppIntent): string {
  const limitedEntities = intent.entities.slice(0, 4);

  return `Generate a complete database schema for this app.

App name: ${intent.appName}
App type: ${intent.appType}
Features: ${intent.features.slice(0, 4).join(", ")}
Entities needed: ${limitedEntities.join(", ")}
NOTE: MVP scope — limit to maximum 4 core entities only.

Return this exact JSON structure:
{
  "entities": [
    {
      "name": "PascalCase entity name",
      "tableName": "snake_case_table_name",
      "fields": [
        { "name": "id", "type": "uuid", "nullable": false, "isPrimary": true, "isUnique": true, "isRelation": false },
        { "name": "tenantId", "type": "uuid", "nullable": false, "isPrimary": false, "isUnique": false, "isRelation": false },
        { "name": "createdAt", "type": "datetime", "nullable": false, "isPrimary": false, "isUnique": false, "isRelation": false }
      ],
      "relations": [
        { "type": "hasMany", "target": "OtherEntity", "foreignKey": "entity_id", "onDelete": "CASCADE" }
      ]
    }
  ]
}

STRICT RULES:
1. Every entity MUST have "id" field: type uuid, isPrimary true, isUnique true, nullable false
2. Every entity MUST have "tenantId" field: type uuid, nullable false
3. tableName MUST be snake_case
4. Every field MUST have all these boolean properties: nullable, isPrimary, isUnique, isRelation
5. field "type" must be one of: string | number | boolean | date | datetime | uuid | text | json | enum
6. Relations MUST be bidirectional (hasMany needs matching belongsTo)
7. All relation targets must exist in the entities array
8. Maximum 4 entities total — no more
9. Maximum 5 fields per entity — keep it minimal
10. Return ONLY the JSON object`;
}

const VALID_FIELD_TYPES = ["string", "number", "boolean", "date", "datetime", "uuid", "text", "json", "enum"];
const VALID_RELATION_TYPES = ["hasMany", "belongsTo", "hasOne"];
const VALID_ON_DELETE = ["CASCADE", "SET_NULL", "RESTRICT"];

function sanitizeSchema(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const schema = parsed as Record<string, unknown>;

  if (!Array.isArray(schema.entities)) schema.entities = [];

  // Limit to max 4 entities
  schema.entities = (schema.entities as Record<string, unknown>[]).slice(0, 4);

  schema.entities = (schema.entities as Record<string, unknown>[]).map((entity) => {
    const name = String(entity.name ?? "Entity");

    // Fix tableName
    let tableName = entity.tableName;
    if (typeof tableName !== "string" || tableName.trim().length === 0) {
      tableName = name.toLowerCase().replace(/\s+/g, "_");
    }

    // Fix fields
    let fields = entity.fields;
    if (!Array.isArray(fields)) fields = [];

    // Limit fields to max 8
    fields = (fields as Record<string, unknown>[]).slice(0, 8);

    fields = (fields as Record<string, unknown>[]).map((field) => {
      let type = field.type;
      if (!VALID_FIELD_TYPES.includes(type as string)) type = "string";

      const nullable   = typeof field.nullable   === "boolean" ? field.nullable   : false;
      const isPrimary  = typeof field.isPrimary  === "boolean" ? field.isPrimary  : false;
      const isUnique   = typeof field.isUnique   === "boolean" ? field.isUnique   : false;
      const isRelation = typeof field.isRelation === "boolean" ? field.isRelation : false;

      return { ...field, type, nullable, isPrimary, isUnique, isRelation };
    });

    // Ensure id field exists
    const hasId = (fields as Record<string, unknown>[]).some((f) => f.name === "id");
    if (!hasId) {
      (fields as Record<string, unknown>[]).unshift({
        name: "id", type: "uuid", nullable: false,
        isPrimary: true, isUnique: true, isRelation: false,
      });
    }

    // Ensure tenantId field exists
    const hasTenantId = (fields as Record<string, unknown>[]).some((f) => f.name === "tenantId");
    if (!hasTenantId) {
      (fields as Record<string, unknown>[]).push({
        name: "tenantId", type: "uuid", nullable: false,
        isPrimary: false, isUnique: false, isRelation: false,
      });
    }

    // Fix relations
    let relations = entity.relations;
    if (!Array.isArray(relations)) relations = [];

    relations = (relations as Record<string, unknown>[])
      .filter((r) => typeof r.target === "string" && r.target.trim().length > 0)
      .map((r) => {
        const type = VALID_RELATION_TYPES.includes(r.type as string) ? r.type : "hasMany";
        const onDelete = VALID_ON_DELETE.includes(r.onDelete as string) ? r.onDelete : "CASCADE";
        const foreignKey = typeof r.foreignKey === "string" && r.foreignKey.trim().length > 0
          ? r.foreignKey
          : `${name.toLowerCase()}_id`;
        return { ...r, type, onDelete, foreignKey };
      });

    return { ...entity, name, tableName, fields, relations };
  });

  // Fix bidirectional relations — add missing reverse relations
  const entityList = schema.entities as Record<string, unknown>[];
  const entityMap = new Map(entityList.map((e) => [e.name as string, e]));

  for (const entity of entityList) {
    const entityName = entity.name as string;
    const relations = entity.relations as Record<string, unknown>[];

    for (const relation of relations) {
      const targetName = relation.target as string;
      const target = entityMap.get(targetName);
      if (!target) continue;

      const targetRelations = target.relations as Record<string, unknown>[];

      if (relation.type === "hasMany") {
        const hasReverse = targetRelations.some(
          (r) => r.type === "belongsTo" && r.target === entityName
        );
        if (!hasReverse) {
          targetRelations.push({
            type: "belongsTo",
            target: entityName,
            foreignKey: `${entityName.toLowerCase()}_id`,
            onDelete: "CASCADE",
          });
        }
      }

      if (relation.type === "belongsTo") {
        const hasReverse = targetRelations.some(
          (r) => r.type === "hasMany" && r.target === entityName
        );
        if (!hasReverse) {
          targetRelations.push({
            type: "hasMany",
            target: entityName,
            foreignKey: `${targetName.toLowerCase()}_id`,
            onDelete: "CASCADE",
          });
        }
      }
    }
  }

  // Ensure at least one entity
  if ((schema.entities as unknown[]).length === 0) {
    schema.entities = [{
      name: "Item",
      tableName: "items",
      fields: [
        { name: "id", type: "uuid", nullable: false, isPrimary: true, isUnique: true, isRelation: false },
        { name: "tenantId", type: "uuid", nullable: false, isPrimary: false, isUnique: false, isRelation: false },
        { name: "name", type: "string", nullable: false, isPrimary: false, isUnique: false, isRelation: false },
      ],
      relations: [],
    }];
  }

  return schema;
}

export interface SchemaStageResult {
  schema: DataSchema;
  validation: ValidationResult;
  cost: StageCost;
  retryCount: number;
}

export async function runSchemaGeneration(
  intent: AppIntent, options?: GatewayOptions
): Promise<SchemaStageResult> {
  let retryCount = 0;
  let lastCost: StageCost | null = null;

  try {
    const { response, cost } = await callModel(STAGE, buildPrompt(intent), { ...options, systemPrompt: SYSTEM_PROMPT });
    lastCost = cost;

    let parsed: unknown;
    try {
      parsed = parseJSON(response.content);
    } catch {
      retryCount++;
      const { response: r, cost: c } = await callModel(
        STAGE,
        `Fix this invalid JSON, return ONLY the corrected JSON:\n\n${response.content}`,
        { ...options, systemPrompt: SYSTEM_PROMPT }
      );
      lastCost = c;
      parsed = parseJSON(r.content);
    }

    parsed = sanitizeSchema(parsed);

    let validation = validateDataSchema(parsed);
    if (validation.valid) return { schema: parsed as DataSchema, validation, cost: lastCost, retryCount };

    retryCount++;
    const validationErrors = validation.errors.map((e) => `- ${e.field}: ${e.message}`).join("\n");
    const fixPrompt = `Your schema had these errors:\n${validationErrors}\n\nFix ALL errors:\n- Every entity needs id (uuid, isPrimary: true) and tenantId (uuid)\n- Every field needs nullable, isPrimary, isUnique, isRelation as booleans\n- field type must be one of: string | number | boolean | date | datetime | uuid | text | json | enum\n- Relations must be bidirectional\n- Maximum 4 entities, 8 fields each\n\nReturn ONLY the corrected JSON.`;

    const { response: fixResponse, cost: fixCost } = await callModel(
      STAGE, fixPrompt, { ...options, systemPrompt: SYSTEM_PROMPT }
    );
    lastCost = fixCost;

    const fixed = sanitizeSchema(parseJSON(fixResponse.content));
    validation = validateDataSchema(fixed);
    return { schema: fixed as DataSchema, validation, cost: lastCost, retryCount };

  } catch (error) {
    throw new Error(
      `[schema_generation] Stage failed after ${retryCount} retries: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}