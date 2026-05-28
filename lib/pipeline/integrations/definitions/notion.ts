import type { IntegrationDefinition } from "@/lib/types";
const notion: IntegrationDefinition = {
  id: "notion", displayName: "Notion", authType: "oauth2", implemented: false,
  triggers: [{ event: "updated", description: "Data change event" }],
  actions: [
    { id: "create_page", displayName: "Create Page", description: "Create a Notion page", inputSchema: { title: "string", content: "string" }, outputSchema: { pageId: "string" } },
    { id: "append_block", displayName: "Append Block", description: "Append a block to a page", inputSchema: { pageId: "string", content: "string" }, outputSchema: { blockId: "string" } },
  ],
};
export default notion;