import type { IntegrationDefinition } from "@/lib/types";
const jira: IntegrationDefinition = {
  id: "jira", displayName: "Jira", authType: "api_key", implemented: false,
  triggers: [{ event: "created", description: "Task or issue event" }],
  actions: [
    { id: "create_issue", displayName: "Create Issue", description: "Create a Jira issue", inputSchema: { projectKey: "string", summary: "string", issueType: "string", description: "string" }, outputSchema: { issueId: "string", issueKey: "string" } },
    { id: "update_status", displayName: "Update Status", description: "Transition a Jira issue status", inputSchema: { issueKey: "string", transitionId: "string" }, outputSchema: { issueKey: "string" } },
  ],
};
export default jira;