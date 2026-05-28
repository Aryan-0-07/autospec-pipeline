import type { IntegrationDefinition } from "@/lib/types";
const twilio: IntegrationDefinition = {
  id: "twilio", displayName: "Twilio SMS", authType: "api_key", implemented: false,
  triggers: [{ event: "status_changed", description: "User action or status change" }],
  actions: [
    { id: "send_sms", displayName: "Send SMS", description: "Send an SMS notification", inputSchema: { to: "string", body: "string", from: "string" }, outputSchema: { messageSid: "string", status: "string" } },
    { id: "send_otp", displayName: "Send OTP", description: "Trigger OTP flow via Twilio Verify", inputSchema: { to: "string", channel: "string" }, outputSchema: { status: "string" } },
  ],
};
export default twilio;