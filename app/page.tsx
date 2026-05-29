// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import type {
  AppSpec, DataSchema, GenerationJob,
  SSEEvent, StageStatus, PipelineStage, IntegrationDefinition,
} from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StageInfo {
  stage: PipelineStage;
  label: string;
  status: StageStatus;
  latencyMs?: number;
  retryCount?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function badge(status: StageStatus) {
  const map: Record<StageStatus, string> = {
    pending:  "bg-gray-700 text-gray-300",
    running:  "bg-yellow-500/20 text-yellow-300 animate-pulse",
    complete: "bg-green-500/20 text-green-400",
    failed:   "bg-red-500/20 text-red-400",
  };
  return map[status];
}

function fmt(ms?: number) {
  if (!ms) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function StageRow({ info }: { info: StageInfo }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge(info.status)}`}>
          {info.status.toUpperCase()}
        </span>
        <span className="text-sm text-gray-200 font-medium">{info.label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {info.retryCount !== undefined && info.retryCount > 0 && (
          <span className="text-yellow-500">
            {info.retryCount} retr{info.retryCount === 1 ? "y" : "ies"}
          </span>
        )}
        {info.latencyMs && <span>{fmt(info.latencyMs)}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function AppSpecPanel({ spec, schema }: { spec: AppSpec; schema?: DataSchema }) {
  return (
    <div className="space-y-6">
      {/* Entities */}
      {schema && (
        <Section title={`Entities (${schema.entities.length})`}>
          <div className="space-y-2">
            {schema.entities.map((e) => (
              <div key={e.name} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-blue-400">{e.name}</span>
                  <span className="text-xs text-gray-500">{e.tableName}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {e.fields.map((f) => (
                    <span key={f.name} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {f.name}: <span className="text-gray-400">{f.type}</span>
                      {f.isPrimary && <span className="text-yellow-400 ml-1">PK</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pages + Endpoints */}
      <Section title="Pages & API Endpoints">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-2 text-gray-400 font-medium pr-4">Page</th>
                <th className="pb-2 text-gray-400 font-medium pr-4">Route</th>
                <th className="pb-2 text-gray-400 font-medium pr-4">Layout</th>
                <th className="pb-2 text-gray-400 font-medium pr-4">Method</th>
                <th className="pb-2 text-gray-400 font-medium pr-4">Endpoint</th>
                <th className="pb-2 text-gray-400 font-medium">Auth</th>
              </tr>
            </thead>
            <tbody>
              {spec.pages.map((page) => {
                const ep = spec.apiEndpoints.find(
                  (e) => e.boundEntity === page.boundEntity
                );
                return (
                  <tr key={page.name} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 text-gray-200 font-medium">{page.name}</td>
                    <td className="py-2 pr-4 text-blue-400 font-mono">{page.route}</td>
                    <td className="py-2 pr-4 text-gray-400">{page.layout}</td>
                    <td className="py-2 pr-4">
                      {ep && (
                        <span className={`font-mono font-bold ${
                          ep.method === "GET"    ? "text-green-400"  :
                          ep.method === "POST"   ? "text-blue-400"   :
                          ep.method === "DELETE" ? "text-red-400"    :
                                                   "text-yellow-400"
                        }`}>{ep.method}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-300">{ep?.path ?? "—"}</td>
                    <td className="py-2 text-gray-400">{ep?.authRequired ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Auth Rules */}
      <Section title="Auth Rules">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {spec.authRules.roles.map((r) => (
              <span key={r} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                {r}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-1 text-gray-400 font-medium text-left pr-4">Role</th>
                  <th className="pb-1 text-gray-400 font-medium text-left pr-4">Entity</th>
                  <th className="pb-1 text-gray-400 font-medium text-left">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(spec.authRules.permissions).flatMap(([role, entities]) =>
                  Object.entries(entities).map(([entity, perms]) => (
                    <tr key={`${role}-${entity}`} className="border-b border-gray-800">
                      <td className="py-1 pr-4 text-purple-300">{role}</td>
                      <td className="py-1 pr-4 text-gray-300">{entity}</td>
                      <td className="py-1 text-gray-400">{perms.join(", ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Workflow Stubs */}
      {(spec.integrationHooks.length > 0 || spec.workflowStubs.length > 0) && (
        <Section title={`Workflows & Integrations (${spec.workflowStubs.length} stubs)`}>
          <div className="space-y-2">
            {spec.workflowStubs.map((stub, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                    {stub.integration}
                  </span>
                  <span className="text-xs text-gray-400">{stub.action}</span>
                </div>
                <p className="text-sm text-gray-200">{stub.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Trigger: <span className="text-gray-400">{stub.trigger.entity}</span>
                  {" → "}{stub.trigger.event}
                  {stub.trigger.condition && stub.trigger.condition.length > 0 && (
                    <span className="text-yellow-500 ml-1">if {stub.trigger.condition}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function IntegrationPanel({ integrations }: { integrations: IntegrationDefinition[] }) {
  const implemented = integrations.filter((i) => i.implemented);
  const stubbed     = integrations.filter((i) => !i.implemented);

  return (
    <div className="space-y-4">
      <Section title={`Fully Implemented (${implemented.length})`}>
        <div className="space-y-2">
          {implemented.map((i) => (
            <div key={i.id} className="bg-gray-800/50 border border-green-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-green-400">{i.displayName}</span>
                <span className="text-xs text-gray-500">{i.authType}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {i.actions.map((a) => (
                  <span key={a.id} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    {a.id}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Stubbed (${stubbed.length})`}>
        <div className="space-y-1">
          {stubbed.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between px-3 py-2 bg-gray-800/30 border border-gray-700/50 rounded"
            >
              <span className="text-sm text-gray-400">{i.displayName}</span>
              <span className="text-xs text-gray-600">{i.authType}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [prompt, setPrompt]       = useState("");
  const [jobId, setJobId]         = useState<string | null>(null);
  const [job, setJob]             = useState<GenerationJob | null>(null);
  const [stages, setStages]       = useState<StageInfo[]>([
    { stage: "intent_extraction",  label: "Intent Extraction",  status: "pending" },
    { stage: "schema_generation",  label: "Schema Generation",  status: "pending" },
    { stage: "appspec_generation", label: "AppSpec Generation", status: "pending" },
  ]);
  const [errors, setErrors]           = useState<{ stage: string; messages: string[] }[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationDefinition[]>([]);
  const [activeTab, setActiveTab]     = useState<"appspec" | "integrations">("appspec");
  const [loading, setLoading]         = useState(false);
  const [statusMsg, setStatusMsg]     = useState("");
  const eventSourceRef                = useRef<EventSource | null>(null);

  // Load integration registry on mount
  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data: IntegrationDefinition[]) => setIntegrations(data))
      .catch(console.error);
  }, []);

  // Poll job status until appSpec is present
  useEffect(() => {
    if (!jobId) return;
    let attempts = 0;
    const maxAttempts = 60; // 120 seconds max at 1 poll/2s

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch(`/api/generate/${jobId}`);
        const data = await res.json() as GenerationJob;

        // Only stop when complete AND appSpec is present
        if (data.status === "complete" && data.appSpec) {
          setJob(data);
          clearInterval(interval);
          return;
        }

        if (data.status === "failed") {
          setJob(data);
          clearInterval(interval);
          return;
        }

        // Complete but no appSpec yet — keep polling
        if (data.status === "complete" && !data.appSpec) {
          console.log("[poll] complete but appSpec not ready yet, retrying...");
        }

        // Give up after maxAttempts
        if (attempts >= maxAttempts) {
          setJob(data);
          clearInterval(interval);
        }

      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  function resetStages() {
    setStages([
      { stage: "intent_extraction",  label: "Intent Extraction",  status: "pending" },
      { stage: "schema_generation",  label: "Schema Generation",  status: "pending" },
      { stage: "appspec_generation", label: "AppSpec Generation", status: "pending" },
    ]);
    setErrors([]);
    setJob(null);
  }

  function updateStageInfo(stage: PipelineStage, update: Partial<StageInfo>) {
    setStages((prev) =>
      prev.map((s) => s.stage === stage ? { ...s, ...update } : s)
    );
  }

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setStatusMsg("Starting pipeline...");
    setJobId(null);
    resetStages();

    eventSourceRef.current?.close();

    try {
      const res  = await fetch("/api/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json() as { jobId: string };
      const currentJobId = data.jobId;

      setJobId(currentJobId);
      setStatusMsg("Pipeline running...");

      // Connect SSE stream
      const es = new EventSource(`/api/generate/${currentJobId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        const event = JSON.parse(e.data as string) as SSEEvent;
        const stage = event.stage as PipelineStage;

        if (event.type === "stage_start") {
          updateStageInfo(stage, { status: "running" });
        }

        if (event.type === "stage_complete") {
          updateStageInfo(stage, {
            status:    "complete",
            latencyMs: (event.data.cost as { latencyMs?: number } | undefined)?.latencyMs,
            retryCount: event.data.retryCount as number | undefined,
          });
        }

        if (event.type === "stage_failed") {
          updateStageInfo(stage, { status: "failed" });
          const errs =
            (event.data.errors as Array<{ message: string }> | undefined)
              ?.map((e) => e.message) ??
            [event.data.error as string ?? "Unknown error"];
          setErrors((prev) => [...prev, { stage, messages: errs }]);
        }

        if (event.type === "generation_complete") {
          setStatusMsg("Generation complete");
          setLoading(false);
          es.close();

          // Immediately fetch final job data — don't wait for poll interval
          setTimeout(async () => {
            try {
              const finalRes = await fetch(`/api/generate/${currentJobId}`);
              const finalJob = await finalRes.json() as GenerationJob;
              if (finalJob.appSpec) {
                setJob(finalJob);
              }
            } catch (err) {
              console.error("Final fetch error:", err);
            }
          }, 500);
        }
      };

      es.onerror = () => {
        setLoading(false);
        setStatusMsg("Stream disconnected — results will appear shortly");
        es.close();
      };

    } catch (err) {
      setStatusMsg(`Error: ${String(err)}`);
      setLoading(false);
    }
  }

  const schema  = job?.stages?.schema_generation?.output as DataSchema | undefined;
  const appSpec = job?.appSpec;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">OneAtlas Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Natural language → validated AppSpec</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">

            {/* Prompt input */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                App Description
              </label>
              <textarea
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={5}
                placeholder="Describe the app you want to build..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? "Generating..." : "Generate AppSpec"}
              </button>
              {statusMsg && (
                <p className="text-xs text-gray-500 mt-2 text-center">{statusMsg}</p>
              )}
            </div>

            {/* Stage progress */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Pipeline Stages
              </h2>
              <div className="space-y-2">
                {stages.map((s) => <StageRow key={s.stage} info={s} />)}
              </div>

              {/* Cost summary */}
              {job?.cost && job.cost.totalEstimatedUSD > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-xs text-gray-500">
                  <span>Total cost</span>
                  <span className="text-green-400">${job.cost.totalEstimatedUSD.toFixed(6)}</span>
                </div>
              )}
              {job?.cost && job.cost.totalLatencyMs > 0 && (
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Total latency</span>
                  <span>{fmt(job.cost.totalLatencyMs)}</span>
                </div>
              )}
            </div>

            {/* Error panel */}
            {errors.length > 0 && (
              <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
                  Validation Errors
                </h2>
                <div className="space-y-3">
                  {errors.map((e, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-gray-400 mb-1">{e.stage}</p>
                      {e.messages.map((m, j) => (
                        <p key={j} className="text-xs text-red-300 bg-red-900/20 rounded px-2 py-1 mb-1">
                          {m}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Repair log */}
                {job?.repairLog && job.repairLog.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Repair Log</p>
                    {job.repairLog.map((r, i) => (
                      <div key={i} className="text-xs mb-1">
                        <span className={`font-semibold ${
                          r.outcome === "repaired"  ? "text-green-400"  :
                          r.outcome === "escalated" ? "text-yellow-400" :
                                                      "text-red-400"
                        }`}>
                          [{r.strategy}] {r.outcome}
                        </span>
                        <span className="text-gray-500 ml-2">{r.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-700 pb-3">
                <button
                  onClick={() => setActiveTab("appspec")}
                  className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                    activeTab === "appspec"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  AppSpec Output
                </button>
                <button
                  onClick={() => setActiveTab("integrations")}
                  className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                    activeTab === "integrations"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Integration Registry
                  <span className="ml-1 text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                    {integrations.length}
                  </span>
                </button>
              </div>

              {activeTab === "appspec" && (
                appSpec ? (
                  <AppSpecPanel spec={appSpec} schema={schema} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-4xl mb-3">⚙️</div>
                    <p className="text-gray-500 text-sm">
                      {loading
                        ? "Generating your AppSpec..."
                        : "Submit a prompt to generate an AppSpec"}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">
                      {loading
                        ? "Results will appear here when complete"
                        : "Results will appear here in real time"}
                    </p>
                  </div>
                )
              )}

              {activeTab === "integrations" && (
                integrations.length > 0 ? (
                  <IntegrationPanel integrations={integrations} />
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">
                    Loading integrations...
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}