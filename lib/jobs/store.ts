// lib/jobs/store.ts
import type {
  GenerationJob,
  JobStatus,
  PipelineStage,
  SSEEvent,
  StageResult,
} from "@/lib/types";
import { randomUUID } from "crypto";

const jobs = new Map<string, GenerationJob>();
const subscribers = new Map<string, Set<(event: SSEEvent) => void>>();

export function createJob(prompt: string): GenerationJob {
  const jobId = randomUUID();
  const job: GenerationJob = {
    jobId,
    prompt,
    status: "pending",
    createdAt: new Date().toISOString(),
    stages: {},
    repairLog: [],
    cost: {
      stages: [],
      totalEstimatedUSD: 0,
      totalLatencyMs: 0,
    },
    events: [],
  };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): GenerationJob | undefined {
  return jobs.get(jobId);
}

export function updateJobStatus(jobId: string, status: JobStatus): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = status;
  if (status === "complete" || status === "failed") {
    job.completedAt = new Date().toISOString();
  }
}

export function updateStage(
  jobId: string,
  stage: PipelineStage,
  update: Partial<StageResult>
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  const existing = job.stages[stage] ?? {
    stage,
    status: "pending",
    repairLog: [],
  };
  job.stages[stage] = { ...existing, ...update };
}

export function emitEvent(jobId: string, event: SSEEvent): void {
  const job = jobs.get(jobId);
  if (job) {
    job.events.push(event);
  }
  const subs = subscribers.get(jobId);
  if (subs) {
    subs.forEach((fn) => fn(event));
  }
}

export function subscribe(
  jobId: string,
  fn: (event: SSEEvent) => void
): () => void {
  if (!subscribers.has(jobId)) {
    subscribers.set(jobId, new Set());
  }
  subscribers.get(jobId)!.add(fn);
  return () => {
    subscribers.get(jobId)?.delete(fn);
  };
}

export function getEvents(jobId: string): SSEEvent[] {
  return jobs.get(jobId)?.events ?? [];
}