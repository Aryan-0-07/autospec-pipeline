import type { IntegrationDefinition } from "@/lib/types";
const zapier: IntegrationDefinition = {
  id: "zapier", displayName: "Zapier", authType: "webhook_secret", implemented: false,
  triggers: [{ event: "created", description: "Any trigger" }],
  actions: [
    { id: "send_webhook", displayName: "Send to Zapier", description: "Send structured payload to Zapier webhook URL", inputSchema: { webhookUrl: "string", payload: "object" }, outputSchema: { status: "string" } },
  ],
};
export default zapier;