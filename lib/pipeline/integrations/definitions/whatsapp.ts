// lib/pipeline/integrations/definitions/whatsapp.ts
import type { IntegrationDefinition } from "@/lib/types";

const whatsapp: IntegrationDefinition = {
  id: "whatsapp",
  displayName: "WhatsApp (via Twilio)",
  authType: "api_key",
  implemented: true,
  triggers: [
    { event: "status_changed", description: "Triggered when a record status changes" },
    { event: "created",        description: "Triggered when a record is created" },
  ],
  actions: [
    {
      id: "send_template_message",
      displayName: "Send Template Message",
      description: "Send a pre-approved WhatsApp template message",
      inputSchema: {
        to:           "string — Recipient phone number in E.164 format (e.g. +1234567890)",
        templateName: "string — Approved WhatsApp template name",
        variables:    "string[] — Template variable values in order",
      },
      outputSchema: {
        messageSid: "string — Twilio message SID",
        status:     "string — Message delivery status",
      },
    },
    {
      id: "send_notification",
      displayName: "Send Notification",
      description: "Send a free-form WhatsApp message (within 24hr session window)",
      inputSchema: {
        to:   "string — Recipient phone number in E.164 format",
        body: "string — Message body text",
      },
      outputSchema: {
        messageSid: "string — Twilio message SID",
        status:     "string — Message delivery status",
      },
    },
  ],
};

export default whatsapp;