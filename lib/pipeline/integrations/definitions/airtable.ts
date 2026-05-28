import type { IntegrationDefinition } from "@/lib/types";

const airtable: IntegrationDefinition = {
  id: "airtable", displayName: "Airtable", authType: "api_key", implemented: false,
  triggers: [{ event: "created", description: "Record event" }],
  actions: [
    { id: "create_record", displayName: "Create Record", description: "Create an Airtable record", inputSchema: { baseId: "string", tableId: "string", fields: "object" }, outputSchema: { recordId: "string" } },
    { id: "update_field", displayName: "Update Field", description: "Update a field value", inputSchema: { baseId: "string", tableId: "string", recordId: "string", field: "string", value: "string" }, outputSchema: { recordId: "string" } },
  ],
};

export default airtable;