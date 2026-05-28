import type { IntegrationDefinition } from "@/lib/types";
const github: IntegrationDefinition = {
  id: "github", displayName: "GitHub", authType: "oauth2", implemented: false,
  triggers: [{ event: "created", description: "Dev workflow trigger" }],
  actions: [
    { id: "create_issue", displayName: "Create Issue", description: "Create a GitHub issue", inputSchema: { owner: "string", repo: "string", title: "string", body: "string" }, outputSchema: { issueNumber: "number", issueUrl: "string" } },
    { id: "trigger_workflow", displayName: "Trigger Workflow", description: "Trigger a GitHub Actions workflow", inputSchema: { owner: "string", repo: "string", workflowId: "string", ref: "string" }, outputSchema: { workflowRunId: "number" } },
  ],
};
export default github;