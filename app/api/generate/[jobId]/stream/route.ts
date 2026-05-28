// app/api/generate/[jobId]/stream/route.ts
import { NextRequest } from "next/server";
import { getJob, getEvents, subscribe } from "@/lib/jobs/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Replay all prior events on reconnect
      const priorEvents = getEvents(jobId);
      for (const event of priorEvents) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      // If job already finished, close immediately
      if (job.status === "complete" || job.status === "failed") {
        controller.close();
        return;
      }

      // Subscribe to new events
      const unsubscribe = subscribe(jobId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
          if (
            event.type === "generation_complete" ||
            event.type === "stage_failed"
          ) {
            unsubscribe();
            controller.close();
          }
        } catch {
          unsubscribe();
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}