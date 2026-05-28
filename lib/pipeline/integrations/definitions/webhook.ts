// lib/pipeline/integrations/definitions/webhook.ts
import type { IntegrationDefinition } from "@/lib/types";

const webhook: IntegrationDefinition = {
  id: "webhook",
  displayName: "Webhook (Generic)",
  authType: "webhook_secret",
  implemented: true,
  triggers: [
    { event: "created",        description: "Any record created event" },
    { event: "updated",        description: "Any record updated event" },
    { event: "deleted",        description: "Any record deleted event" },
    { event: "status_changed", description: "Any status change event" },
  ],
  actions: [
    {
      id: "post_payload",
      displayName: "POST Payload",
      description: "POST a structured payload to a configured URL with HMAC signature",
      inputSchema: {
        url:     "string — Target webhook URL",
        payload: "object — JSON payload to send",
        secret:  "string — HMAC signing secret for request verification",
      },
      outputSchema: {
        statusCode: "number — HTTP response status code",
        response:   "string — Response body from the target URL",
      },
    },
  ],
};

export default webhook;