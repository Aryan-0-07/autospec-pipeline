// lib/pipeline/validation/schemas.ts
import { z } from "zod";

// ─────────────────────────────────────────
// Stage 1 — AppIntent
// ─────────────────────────────────────────

export const AppTypeSchema = z.enum([
  "crm",
  "project_management",
  "ecommerce",
  "hr_tool",
  "inventory",
  "content_platform",
  "analytics",
  "custom",
]);

export const AppIntentSchema = z.object({
  appName: z.string().min(1),
  appType: AppTypeSchema,
  features: z.array(z.string()).min(1),
  entities: z.array(z.string()).min(1),
  integrations_requested: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarification_required: z
    .object({
      flag: z.literal(true),
      question: z.string().min(1),
    })
    .optional(),
});

// ─────────────────────────────────────────
// Stage 2 — DataSchema
// ─────────────────────────────────────────

export const FieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "uuid",
  "text",
  "json",
  "enum",
]);

export const RelationTypeSchema = z.enum([
  "hasMany",
  "belongsTo",
  "hasOne",
]);

export const OnDeleteSchema = z.enum([
  "CASCADE",
  "SET_NULL",
  "RESTRICT",
]);

export const FieldSchema = z.object({
  name: z.string().min(1),
  type: FieldTypeSchema,
  nullable: z.boolean(),
  isPrimary: z.boolean(),
  isUnique: z.boolean(),
  isRelation: z.boolean(),
  enumValues: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

export const RelationSchema = z.object({
  type: RelationTypeSchema,
  target: z.string().min(1),
  foreignKey: z.string().min(1),
  onDelete: OnDeleteSchema,
});

export const EntitySchema = z.object({
  name: z.string().min(1),
  tableName: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, {
    message: "tableName must be snake_case",
  }),
  fields: z.array(FieldSchema).min(1),
  relations: z.array(RelationSchema),
});

export const DataSchemaSchema = z.object({
  entities: z.array(EntitySchema).min(1),
});

// ─────────────────────────────────────────
// Stage 3 — AppSpec
// ─────────────────────────────────────────

export const PageLayoutSchema = z.enum([
  "list",
  "detail",
  "dashboard",
  "settings",
]);

export const ComponentTypeSchema = z.enum([
  "table",
  "form",
  "chart",
  "card",
]);

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

export const PermissionSchema = z.enum(["read", "write", "delete"]);

export const IntegrationEventSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "status_changed",
]);

export const PageSpecSchema = z.object({
  name: z.string().min(1),
  route: z.string().startsWith("/"),
  layout: PageLayoutSchema,
  boundEntity: z.string().min(1),
  components: z.array(ComponentTypeSchema).min(1),
});

export const ApiEndpointSchema = z.object({
  path: z.string().startsWith("/"),
  method: HttpMethodSchema,
  handlerDescription: z.string().min(1),
  boundEntity: z.string().min(1),
  authRequired: z.boolean(),
  rateLimitFlag: z.boolean(),
});

export const AuthRulesSchema = z.object({
  roles: z.array(z.string()).min(1),
  permissions: z.record(z.string(), z.record(z.string(), z.array(PermissionSchema))),});


export const IntegrationHookSchema = z.object({
  integrationId: z.string().min(1),
  actionId: z.string().min(1),
  triggerEntity: z.string().min(1),
  triggerEvent: IntegrationEventSchema,
  condition: z.string().optional().nullable().transform((v) => v ?? ""),
});

export const WorkflowPayloadFieldSchema = z.object({
  sourceField: z.string().min(1),
  targetParam: z.string().min(1),
});

export const WorkflowStubSchema = z.object({
  name: z.string().min(1),
  trigger: z.object({
    entity: z.string().min(1),
    event: IntegrationEventSchema,
    condition: z.string().optional().nullable().transform((v) => v ?? ""),
  }),
  integration: z.string().min(1),
  action: z.string().min(1),
  payload: z.array(WorkflowPayloadFieldSchema),
});

export const AppSpecSchema = z.object({
  pages: z.array(PageSpecSchema).min(1),
  apiEndpoints: z.array(ApiEndpointSchema).min(1),
  authRules: AuthRulesSchema,
  integrationHooks: z.array(IntegrationHookSchema),
  workflowStubs: z.array(WorkflowStubSchema),
});