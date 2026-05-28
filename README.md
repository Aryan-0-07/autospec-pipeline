# OneAtlas Pipeline

A multi-stage AI generation pipeline that converts a natural language app description into a validated, machine-readable AppSpec object.

---

## Local Setup (under 5 minutes)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/oneatlas-pipeline.git
cd oneatlas-pipeline
```

### 2. Install dependencies
```bash
npm install
```

### 3. Copy environment variables
```bash
cp .env.example .env.local
```

### 4. Fill in your API keys in `.env.local`
```env
GROQ_API_KEY=your_groq_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
```
At minimum, GROQ_API_KEY and OPENROUTER_API_KEY are required to run the pipeline.

### 5. Start the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type a prompt and click **Generate AppSpec**.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Primary provider for all stages (free tier) |
| `OPENROUTER_API_KEY` | ✅ Yes | Universal fallback on 429/5xx |
| `ANTHROPIC_API_KEY` | ⬜ Optional | Claude Sonnet/Haiku — not funded, stubbed |
| `OPENAI_API_KEY` | ⬜ Optional | GPT-4o/mini — stubbed |
| `GEMINI_API_KEY` | ⬜ Optional | Gemini 1.5 Flash/Pro — stubbed |
| `GOOGLE_AI_API_KEY` | ⬜ Optional | Google AI SDK — stubbed |
| `DEEPSEEK_API_KEY` | ⬜ Optional | DeepSeek-V2 — stubbed |
| `MISTRAL_API_KEY` | ⬜ Optional | Mistral Large/7B — stubbed |
| `NEXT_PUBLIC_APP_URL` | ⬜ Optional | Defaults to http://localhost:3000 |

---

## Pipeline Architecture

## Pipeline Architecture

## Pipeline Architecture

```text
User Prompt (string)
│
▼
┌─────────────────────┐
│  Stage 1            │
│  Intent Extraction  │  → AppIntent (appName, appType, features, entities,
└─────────────────────┘    integrations_requested, assumptions)
│
▼ Zod Validation
│
┌─────────────────────┐
│  Stage 2            │
│  Schema Generation  │  → DataSchema (entities, fields, relations, tenantId)
└─────────────────────┘
│
▼ Zod Validation + relation consistency check
│
┌─────────────────────┐
│  Stage 3            │
│  AppSpec Generation │  → AppSpec (pages, apiEndpoints, authRules,
└─────────────────────┘    integrationHooks, workflowStubs)
│
▼ Zod Validation + cross-layer reference check
│
┌─────────────────────┐
│  Repair Engine      │  → structural → field → consistency → escalate
└─────────────────────┘
│
▼
Final AppSpec

### Key files

| File | Purpose |
|---|---|
| `lib/types/index.ts` | All shared TypeScript types |
| `lib/config/routing.config.ts` | Maps each stage to primary + fallback model |
| `lib/config/cost.table.ts` | Per-token cost rates for all 8 providers |
| `lib/pipeline/gateway/gateway.ts` | callModel() — primary → fallback → OpenRouter |
| `lib/pipeline/stages/intent.ts` | Stage 1 — intent extraction |
| `lib/pipeline/stages/schema.ts` | Stage 2 — schema generation |
| `lib/pipeline/stages/appspec.ts` | Stage 3 — AppSpec generation + sanitization |
| `lib/pipeline/validation/validator.ts` | Zod validation for all 3 stage outputs |
| `lib/pipeline/repair/engine.ts` | Repair orchestrator |
| `lib/pipeline/repair/structural.ts` | Structural repair strategy |
| `lib/pipeline/repair/field.ts` | Field repair strategy |
| `lib/pipeline/repair/consistency.ts` | Consistency repair strategy |
| `lib/pipeline/integrations/registry.ts` | Integration registry with O(1) lookup |
| `lib/jobs/store.ts` | In-memory job store + SSE subscriber map |
| `app/api/generate/route.ts` | POST /api/generate |
| `app/api/generate/[jobId]/route.ts` | GET /api/generate/:jobId |
| `app/api/generate/[jobId]/stream/route.ts` | SSE stream |
| `app/api/integrations/route.ts` | GET /api/integrations |

---

## Model Routing

All model selection is driven by `lib/config/routing.config.ts`. No model names are hardcoded in stage implementations.

| Stage | Primary | Fallback | OpenRouter Fallback |
|---|---|---|---|
| intent_extraction | groq/llama-3.1-8b-instant | groq/llama-3.3-70b-versatile | meta-llama/llama-3.1-8b-instruct |
| schema_generation | groq/llama-3.3-70b-versatile | groq/llama-3.1-8b-instant | meta-llama/llama-3.1-8b-instruct |
| appspec_generation | groq/llama-3.3-70b-versatile | groq/llama-3.1-8b-instant | meta-llama/llama-3.1-8b-instruct |
| repair | groq/llama-3.3-70b-versatile | groq/llama-3.1-8b-instant | meta-llama/llama-3.1-8b-instruct |

On any 429 or 5xx, the gateway automatically retries via the fallback, then OpenRouter.

---

## Repair Engine

Three classified strategies run in sequence before escalating to a re-prompt:

| Strategy | Handles | Approach |
|---|---|---|
| Structural | Malformed/truncated JSON | Extract valid JSON boundaries, close open braces, strip trailing commas |
| Field | Missing or wrong-typed fields | Inject typed defaults for known field names |
| Consistency | Broken cross-layer references | Fix page→entity refs, add missing endpoints, repair auth roles deterministically |

Every repair attempt is logged with: `strategy`, `errorInput`, `outcome` (repaired / escalated / failed), `detail`, `timestamp`.

---

## Integration Registry

14 integrations registered. 5 fully implemented, 9 stubbed with correct interface.

| Integration | Status | Auth Type |
|---|---|---|
| Slack | ✅ Implemented | oauth2 |
| Stripe | ✅ Implemented | api_key |
| WhatsApp (via Twilio) | ✅ Implemented | api_key |
| Gmail / Google Workspace | ✅ Implemented | oauth2 |
| Webhook (Generic) | ✅ Implemented | webhook_secret |
| Notion | ⬜ Stubbed | oauth2 |
| Airtable | ⬜ Stubbed | api_key |
| HubSpot | ⬜ Stubbed | oauth2 |
| Salesforce | ⬜ Stubbed | oauth2 |
| Jira | ⬜ Stubbed | api_key |
| GitHub | ⬜ Stubbed | oauth2 |
| Twilio SMS | ⬜ Stubbed | api_key |
| Zapier | ⬜ Stubbed | webhook_secret |
| Google Sheets | ⬜ Stubbed | oauth2 |

Stubbed integrations have a complete interface (id, displayName, authType, triggers, actions with input/output schemas) and `implemented: false`. A developer can implement the actual API call from the stub alone.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/generate` | Accepts `{ prompt }`, returns `{ jobId }` |
| GET | `/api/generate/:jobId` | Full job status, AppSpec, repair log, cost breakdown |
| GET | `/api/generate/:jobId/stream` | SSE stream — stage_start, stage_complete, stage_failed, generation_complete |
| POST | `/api/generate/:jobId/repair` | Manually trigger repair on a stage |
| GET | `/api/integrations` | Full integration registry |

---

## Scope Decisions

Deliberate cuts made to stay within the 72-hour window:

| Cut | Reason | Impact |
|---|---|---|
| Anthropic, OpenAI, Gemini, DeepSeek, Mistral providers stubbed | API keys not funded or not set up. Groq (free) + OpenRouter (fallback) cover all pipeline needs. | Providers are wired and dispatch-ready — adding a key activates them instantly. |
| 9 integrations stubbed | 5 fully implemented integrations cover the most common use cases (Slack, Stripe, WhatsApp, Gmail, Webhook). | Stubs have complete interfaces. Zero validation impact — registry checks still run. |
| No Redis job store | In-memory store is sufficient for evaluation. | Jobs are lost on server restart. Redis swap is a one-file change in `lib/jobs/store.ts`. |
| Manual repair endpoint not wired to frontend | POST `/:jobId/repair` exists and works via curl. Not surfaced in the UI. | Repair engine runs automatically on every failed validation. Manual trigger is for testing only. |

---

## Evaluation Results

12/12 prompts passed. See `evaluation-log.json` for full results.

- Success rate: 100%
- Average latency: 10.99s
- Average cost per run: $0.000226
- Total cost for all 12 runs: $0.002717
- Weakest stage: AppSpec generation (2 retries across 12 runs)