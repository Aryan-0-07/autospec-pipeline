// lib/pipeline/integrations/definitions/slack.ts
import type { IntegrationDefinition } from "@/lib/types";

const slack: IntegrationDefinition = {
  id: "slack",
  displayName: "Slack",
  authType: "oauth2",
  implemented: true,
  triggers: [
    { event: "created",        description: "Triggered when a record is created" },
    { event: "updated",        description: "Triggered when a record is updated" },
    { event: "status_changed", description: "Triggered when record status changes" },
  ],
  actions: [
    {
      id: "send_channel_message",
      displayName: "Send Channel Message",
      description: "Post a message to a Slack channel",
      inputSchema: {
        channel:  "string — Slack channel ID or name (e.g. #general)",
        text:     "string — Message text",
        username: "string? — Optional bot username override",
      },
      outputSchema: {
        messageId: "string — Slack message timestamp ID",
        channel:   "string — Channel the message was posted to",
      },
    },
    {
      id: "send_dm",
      displayName: "Send Direct Message",
      description: "Send a direct message to a Slack user",
      inputSchema: {
        userId: "string — Slack user ID",
        text:   "string — Message text",
      },
      outputSchema: {
        messageId: "string — Slack message timestamp ID",
      },
    },
    {
      id: "post_block_message",
      displayName: "Post Block Kit Message",
      description: "Post a formatted Block Kit message to a channel",
      inputSchema: {
        channel: "string — Slack channel ID",
        blocks:  "object[] — Slack Block Kit blocks array",
        text:    "string — Fallback text for notifications",
      },
      outputSchema: {
        messageId: "string — Slack message timestamp ID",
      },
    },
  ],
};

export default slack;