// lib/types/index.ts

// ─────────────────────────────────────────
// Enums & Literals
// ─────────────────────────────────────────

export type AppType =
  | "crm"
  | "project_management"
  | "ecommerce"
  | "hr_tool"
  | "inventory"
  | "content_platform"
  | "analytics"
  | "custom";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "uuid"
  | "text"
  | "json"
  | "enum";

export type RelationType = "hasMany" | "belongsTo" | "hasOne";

export type OnDeleteAction = "CASCADE" | "SET_NULL" | "RESTRICT";

export type PageLayout = "list" | "detail" | "dashboard" | "settings";

export type ComponentType = "table" | "form" | "chart" | "card";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Permission = "read" | "write" | "delete";

export type IntegrationEvent =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed";

export type AuthType = "oauth2" | "api_key" | "webhook_secret" | "none";

// ─────────────────────────────────────────
// Stage 1 — AppIntent
// ─────────────────────────────────────────

export interface AppIntent {
  appName: string;
  appType: AppType;
  features: string[];
  entities: string[];
  integrations_requested: string[];
  assumptions: string[];
  clarification_required?: {
    flag: true;
    question: string;
  };
}

// ─────────────────────────────────────────
// Stage 2 — DataSchema
// ─────────────────────────────────────────

export interface FieldSchema {
  name: string;
  type: FieldType;
  nullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  isRelation: boolean;
  enumValues?: string[];
  defaultValue?: string;
}

export interface RelationSchema {
  type: RelationType;
  target: string;
  foreignKey: string;
  onDelete: OnDeleteAction;
}

export interface EntitySchema {
  name: string;
  tableName: string;
  fields: FieldSchema[];
  relations: RelationSchema[];
}

export interface DataSchema {
  entities: EntitySchema[];
}

// ─────────────────────────────────────────
// Stage 3 — AppSpec
// ─────────────────────────────────────────

export interface PageSpec {
  name: string;
  route: string;
  layout: PageLayout;
  boundEntity: string;
  components: ComponentType[];
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  handlerDescription: string;
  boundEntity: string;
  authRequired: boolean;
  rateLimitFlag: boolean;
}

export interface PermissionMatrix {
  [role: string]: {
    [entity: string]: Permission[];
  };
}

export interface AuthRules {
  roles: string[];
  permissions: PermissionMatrix;
}

export interface IntegrationHook {
  integrationId: string;
  actionId: string;
  triggerEntity: string;
  triggerEvent: IntegrationEvent;
  condition?: string;
}

export interface WorkflowPayloadField {
  sourceField: string;
  targetParam: string;
}

export interface WorkflowStub {
  name: string;
  trigger: {
    entity: string;
    event: IntegrationEvent;
    condition?: string;
  };
  integration: string;
  action: string;
  payload: WorkflowPayloadField[];
}

export interface AppSpec {
  pages: PageSpec[];
  apiEndpoints: ApiEndpoint[];
  authRules: AuthRules;
  integrationHooks: IntegrationHook[];
  workflowStubs: WorkflowStub[];
}

// ─────────────────────────────────────────
// Validation
// ─────────────────────────────────────────

export type ValidationErrorCode =
  | "MISSING_FIELD"
  | "WRONG_TYPE"
  | "INVALID_REFERENCE"
  | "PAGE_WITHOUT_ENDPOINT"
  | "UNKNOWN_ROLE"
  | "UNKNOWN_INTEGRATION"
  | "UNKNOWN_ACTION"
  | "MISSING_TENANT_ID"
  | "INCONSISTENT_RELATION"
  | "MALFORMED_JSON";

export interface ValidationError {
  code: ValidationErrorCode;
  field: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─────────────────────────────────────────
// Repair
// ─────────────────────────────────────────

export type RepairStrategy = "structural" | "field" | "consistency";

export type RepairOutcome = "repaired" | "escalated" | "failed";

export interface RepairAttempt {
  strategy: RepairStrategy;
  errorInput: ValidationError[];
  outcome: RepairOutcome;
  detail: string;
  timestamp: string;
}

// ─────────────────────────────────────────
// AI Gateway
// ─────────────────────────────────────────

export type PipelineStage =
  | "intent_extraction"
  | "schema_generation"
  | "appspec_generation"
  | "repair";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "groq"
  | "gemini"
  | "google_ai"
  | "deepseek"
  | "openrouter"
  | "mistral";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GatewayOptions {
  forceProvider?: ProviderId;
  systemPrompt?: string;
}

export interface GatewayResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  provider: ProviderId;
  model: string;
  latencyMs: number;
}

// ─────────────────────────────────────────
// Cost tracking
// ─────────────────────────────────────────

export interface StageCost {
  stage: PipelineStage;
  provider: ProviderId;
  model: string;
  tokensIn: number;
  tokensOut: number;
  estimatedUSD: number;
  latencyMs: number;
}

export interface CostBreakdown {
  stages: StageCost[];
  totalEstimatedUSD: number;
  totalLatencyMs: number;
}

// ─────────────────────────────────────────
// Integration registry
// ─────────────────────────────────────────

export interface ActionDescriptor {
  id: string;
  displayName: string;
  description: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
}

export interface TriggerDescriptor {
  event: IntegrationEvent;
  description: string;
}

export interface IntegrationDefinition {
  id: string;
  displayName: string;
  authType: AuthType;
  implemented: boolean;
  triggers: TriggerDescriptor[];
  actions: ActionDescriptor[];
}

// ─────────────────────────────────────────
// Job store
// ─────────────────────────────────────────

export type JobStatus = "pending" | "running" | "complete" | "failed";

export type StageStatus = "pending" | "running" | "complete" | "failed";

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  output?: AppIntent | DataSchema | AppSpec;
  errors?: ValidationError[];
  repairLog: RepairAttempt[];
  cost?: StageCost;
}

export interface GenerationJob {
  jobId: string;
  prompt: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  stages: Partial<Record<PipelineStage, StageResult>>;
  appSpec?: AppSpec;
  repairLog: RepairAttempt[];
  cost: CostBreakdown;
  events: SSEEvent[];
}

// ─────────────────────────────────────────
// SSE events
// ─────────────────────────────────────────

export type SSEEventType =
  | "stage_start"
  | "stage_complete"
  | "stage_failed"
  | "generation_complete";

export interface SSEEvent {
  type: SSEEventType;
  stage: PipelineStage;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────
// API shapes
// ─────────────────────────────────────────

export interface GenerateRequest {
  prompt: string;
}

export interface GenerateResponse {
  jobId: string;
}

export interface RepairRequest {
  stage: PipelineStage;
  errorHint?: string;
}