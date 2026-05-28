import type { IntegrationDefinition } from "@/lib/types";
const google_sheets: IntegrationDefinition = {
  id: "google_sheets", displayName: "Google Sheets", authType: "oauth2", implemented: false,
  triggers: [{ event: "updated", description: "Data export event" }],
  actions: [
    { id: "append_row", displayName: "Append Row", description: "Append a row to a sheet", inputSchema: { spreadsheetId: "string", sheetName: "string", values: "string[]" }, outputSchema: { updatedRange: "string" } },
    { id: "update_cell", displayName: "Update Cell", description: "Update a specific cell", inputSchema: { spreadsheetId: "string", range: "string", value: "string" }, outputSchema: { updatedRange: "string" } },
  ],
};
export default google_sheets;