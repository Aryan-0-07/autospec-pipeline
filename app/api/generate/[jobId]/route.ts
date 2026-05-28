// app/api/generate/[jobId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}