import type { IntegrationDefinition } from "@/lib/types";

const salesforce: IntegrationDefinition = {
  id: "salesforce", displayName: "Salesforce", authType: "oauth2", implemented: false,
  triggers: [{ event: "updated", description: "CRM entity synced" }],
  actions: [
    { id: "create_lead", displayName: "Create Lead", description: "Create a Salesforce lead", inputSchema: { firstName: "string", lastName: "string", email: "string", company: "string" }, outputSchema: { leadId: "string" } },
    { id: "update_opportunity", displayName: "Update Opportunity", description: "Update a Salesforce opportunity", inputSchema: { opportunityId: "string", stage: "string", amount: "number" }, outputSchema: { opportunityId: "string" } },
  ],
};

export default salesforce;