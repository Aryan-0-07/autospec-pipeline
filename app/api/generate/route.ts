// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { GenerateRequest, GenerateResponse } from "@/lib/types";
import { createJob, updateJobStatus, updateStage, emitEvent } from "@/lib/jobs/store";
import { runIntentExtraction } from "@/lib/pipeline/stages/intent";
import { runSchemaGeneration } from "@/lib/pipeline/stages/schema";
import { runAppSpecGeneration } from "@/lib/pipeline/stages/appspec";
import { runRepairEngine } from "@/lib/pipeline/repair/engine";

async function runPipeline(jobId: string, prompt: string): Promise<void> {
  const jobs = await import("@/lib/jobs/store");

  function emit(
    type: "stage_start" | "stage_complete" | "stage_failed" | "generation_complete",
    stage: "intent_extraction" | "schema_generation" | "appspec_generation" | "repair",
    data: Record<string, unknown>
  ) {
    jobs.emitEvent(jobId, {
      type,
      stage,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  try {
    updateJobStatus(jobId, "running");

    // ── Stage 1: Intent Extraction ──
    emit("stage_start", "intent_extraction", { prompt });
    updateStage(jobId, "intent_extraction", {
      stage: "intent_extraction",
      status: "running",
      startedAt: new Date().toISOString(),
      repairLog: [],
    });

    let intentResult;
    try {
      intentResult = await runIntentExtraction(prompt);
    } catch (err) {
      updateStage(jobId, "intent_extraction", {
        status: "failed",
        completedAt: new Date().toISOString(),
        errors: [{ code: "MISSING_FIELD", field: "intent", message: String(err) }],
      });
      emit("stage_failed", "intent_extraction", { error: String(err) });
      updateJobStatus(jobId, "failed");
      return;
    }

    updateStage(jobId, "intent_extraction", {
      status: intentResult.validation.valid ? "complete" : "failed",
      completedAt: new Date().toISOString(),
      output: intentResult.intent,
      errors: intentResult.validation.errors,
      cost: intentResult.cost,
    });
    emit("stage_complete", "intent_extraction", {
      intent: intentResult.intent,
      valid: intentResult.validation.valid,
      retryCount: intentResult.retryCount,
      cost: intentResult.cost,
    });

    // ── Stage 2: Schema Generation ──
    emit("stage_start", "schema_generation", {});
    updateStage(jobId, "schema_generation", {
      stage: "schema_generation",
      status: "running",
      startedAt: new Date().toISOString(),
      repairLog: [],
    });

    let schemaResult;
    try {
      schemaResult = await runSchemaGeneration(intentResult.intent);
    } catch (err) {
      updateStage(jobId, "schema_generation", {
        status: "failed",
        completedAt: new Date().toISOString(),
        errors: [{ code: "MISSING_FIELD", field: "schema", message: String(err) }],
      });
      emit("stage_failed", "schema_generation", { error: String(err) });
      updateJobStatus(jobId, "failed");
      return;
    }

    // Run repair if schema validation failed
    if (!schemaResult.validation.valid) {
      const repair = await runRepairEngine(
        "schema_generation",
        JSON.stringify(schemaResult.schema),
        schemaResult.validation.errors,
        schemaResult.cost.provider,
        schemaResult.cost.model
      );
      if (repair.success) {
        schemaResult.schema = repair.value as typeof schemaResult.schema;
        schemaResult.validation = { valid: true, errors: [] };
      }
      updateStage(jobId, "schema_generation", { repairLog: repair.log });
    }

    updateStage(jobId, "schema_generation", {
      status: schemaResult.validation.valid ? "complete" : "failed",
      completedAt: new Date().toISOString(),
      output: schemaResult.schema,
      errors: schemaResult.validation.errors,
      cost: schemaResult.cost,
    });
    emit("stage_complete", "schema_generation", {
      entityCount: schemaResult.schema.entities.length,
      valid: schemaResult.validation.valid,
      retryCount: schemaResult.retryCount,
      cost: schemaResult.cost,
    });

    if (!schemaResult.validation.valid) {
      emit("stage_failed", "schema_generation", { errors: schemaResult.validation.errors });
      updateJobStatus(jobId, "failed");
      return;
    }

    // ── Stage 3: AppSpec Generation ──
    emit("stage_start", "appspec_generation", {});
    updateStage(jobId, "appspec_generation", {
      stage: "appspec_generation",
      status: "running",
      startedAt: new Date().toISOString(),
      repairLog: [],
    });

    let appSpecResult;
    try {
      appSpecResult = await runAppSpecGeneration(schemaResult.schema, intentResult.intent);
    } catch (err) {
      updateStage(jobId, "appspec_generation", {
        status: "failed",
        completedAt: new Date().toISOString(),
        errors: [{ code: "MISSING_FIELD", field: "appspec", message: String(err) }],
      });
      emit("stage_failed", "appspec_generation", { error: String(err) });
      updateJobStatus(jobId, "failed");
      return;
    }

    // Run repair if appspec validation failed
    if (!appSpecResult.validation.valid) {
      const repair = await runRepairEngine(
        "appspec_generation",
        JSON.stringify(appSpecResult.appSpec),
        appSpecResult.validation.errors,
        appSpecResult.cost.provider,
        appSpecResult.cost.model,
        schemaResult.schema
      );
      if (repair.success) {
        appSpecResult.appSpec = repair.value as typeof appSpecResult.appSpec;
        appSpecResult.validation = { valid: true, errors: [] };
      }
      updateStage(jobId, "appspec_generation", { repairLog: repair.log });
    }

    updateStage(jobId, "appspec_generation", {
      status: appSpecResult.validation.valid ? "complete" : "failed",
      completedAt: new Date().toISOString(),
      output: appSpecResult.appSpec,
      errors: appSpecResult.validation.errors,
      cost: appSpecResult.cost,
    });
    emit("stage_complete", "appspec_generation", {
      pageCount: appSpecResult.appSpec?.pages?.length ?? 0,
      endpointCount: appSpecResult.appSpec?.apiEndpoints?.length ?? 0,
      valid: appSpecResult.validation.valid,
      retryCount: appSpecResult.retryCount,
      cost: appSpecResult.cost,
    });

    if (!appSpecResult.validation.valid) {
      emit("stage_failed", "appspec_generation", { errors: appSpecResult.validation.errors });
      updateJobStatus(jobId, "failed");
      return;
    }

    // ── Finalize ──
    const job = jobs.getJob(jobId);
    if (!job) return;

    const totalUSD = [
      intentResult.cost,
      schemaResult.cost,
      appSpecResult.cost,
    ].reduce((sum, c) => sum + c.estimatedUSD, 0);

    const totalLatency = [
      intentResult.cost,
      schemaResult.cost,
      appSpecResult.cost,
    ].reduce((sum, c) => sum + c.latencyMs, 0);

    job.appSpec = appSpecResult.appSpec;
    job.cost = {
      stages: [intentResult.cost, schemaResult.cost, appSpecResult.cost],
      totalEstimatedUSD: Math.round(totalUSD * 1_000_000) / 1_000_000,
      totalLatencyMs: totalLatency,
    };

    updateJobStatus(jobId, "complete");
    emit("generation_complete", "appspec_generation", {
      jobId,
      totalCostUSD: job.cost.totalEstimatedUSD,
      totalLatencyMs: job.cost.totalLatencyMs,
    });

  } catch (err) {
    updateJobStatus(jobId, "failed");
    console.error("[pipeline] Unhandled error:", err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as GenerateRequest;
    if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const job = createJob(body.prompt.trim());
    runPipeline(job.jobId, job.prompt).catch(console.error);

    return NextResponse.json({ jobId: job.jobId } satisfies GenerateResponse, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}