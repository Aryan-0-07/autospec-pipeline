// lib/pipeline/integrations/definitions/gmail.ts
import type { IntegrationDefinition } from "@/lib/types";

const gmail: IntegrationDefinition = {
  id: "gmail",
  displayName: "Gmail / Google Workspace",
  authType: "oauth2",
  implemented: true,
  triggers: [
    { event: "created", description: "Triggered when a record is created" },
    { event: "updated", description: "Triggered when a record is updated" },
  ],
  actions: [
    {
      id: "send_email",
      displayName: "Send Email",
      description: "Send an email via Gmail",
      inputSchema: {
        to:      "string — Recipient email address",
        subject: "string — Email subject line",
        body:    "string — Email body (plain text or HTML)",
        cc:      "string? — CC recipients comma-separated",
      },
      outputSchema: {
        messageId: "string — Gmail message ID",
        threadId:  "string — Gmail thread ID",
      },
    },
    {
      id: "create_calendar_event",
      displayName: "Create Calendar Event",
      description: "Create a Google Calendar event",
      inputSchema: {
        title:       "string — Event title",
        startTime:   "string — ISO 8601 start datetime",
        endTime:     "string — ISO 8601 end datetime",
        attendees:   "string[] — Attendee email addresses",
        description: "string? — Event description",
      },
      outputSchema: {
        eventId:  "string — Google Calendar event ID",
        eventUrl: "string — Link to the calendar event",
      },
    },
  ],
};

export default gmail;