import type { IntegrationDefinition } from "@/lib/types";
const hubspot: IntegrationDefinition = {
  id: "hubspot", displayName: "HubSpot", authType: "oauth2", implemented: false,
  triggers: [{ event: "created", description: "Contact or deal event" }],
  actions: [
    { id: "create_contact", displayName: "Create Contact", description: "Create a HubSpot contact", inputSchema: { email: "string", firstName: "string", lastName: "string" }, outputSchema: { contactId: "string" } },
    { id: "update_deal_stage", displayName: "Update Deal Stage", description: "Update a deal stage", inputSchema: { dealId: "string", stage: "string" }, outputSchema: { dealId: "string" } },
  ],
};
export default hubspot;