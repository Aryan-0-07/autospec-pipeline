// app/api/generate/[jobId]/repair/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getJob, updateStage } from "@/lib/jobs/store";
import { runRepairEngine } from "@/lib/pipeline/repair/engine";
import { validateAppIntent, validateDataSchema, validateAppSpec } from "@/lib/pipeline/validation/validator";
import type { RepairRequest, PipelineStage, AppSpec, DataSchema, AppIntent } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json() as RepairRequest;
  const { stage } = body;

  const stageResult = job.stages[stage];
  if (!stageResult?.output) {
    return NextResponse.json({ error: "No output found for this stage" }, { status: 400 });
  }

  // Get current validation errors
  let validation;
  const schemaStage = job.stages["schema_generation"];
  const dataSchema = schemaStage?.output as DataSchema | undefined;

  if (stage === "intent_extraction") {
    validation = validateAppIntent(stageResult.output);
  } else if (stage === "schema_generation") {
    validation = validateDataSchema(stageResult.output);
  } else {
    validation = validateAppSpec(stageResult.output, dataSchema ?? { entities: [] });
  }

  if (validation.valid) {
    return NextResponse.json({ message: "Output is already valid", repairLog: [] });
  }

  const repair = await runRepairEngine(
    stage as PipelineStage,
    JSON.stringify(stageResult.output),
    validation.errors,
    "groq",
    "llama-3.3-70b-versatile",
    dataSchema
  );

  updateStage(jobId, stage, {
    output: repair.value as AppIntent | DataSchema | AppSpec,
    repairLog: repair.log,
    status: repair.success ? "complete" : "failed",
  });

  return NextResponse.json({ success: repair.success, repairLog: repair.log });
}