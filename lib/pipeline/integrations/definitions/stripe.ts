// lib/pipeline/integrations/definitions/stripe.ts
import type { IntegrationDefinition } from "@/lib/types";

const stripe: IntegrationDefinition = {
  id: "stripe",
  displayName: "Stripe",
  authType: "api_key",
  implemented: true,
  triggers: [
    { event: "created",        description: "Payment or subscription created" },
    { event: "updated",        description: "Payment or subscription updated" },
    { event: "status_changed", description: "Payment status changed" },
  ],
  actions: [
    {
      id: "create_customer",
      displayName: "Create Customer",
      description: "Create a new Stripe customer",
      inputSchema: {
        email:    "string — Customer email address",
        name:     "string? — Customer full name",
        metadata: "object? — Key-value metadata",
      },
      outputSchema: {
        customerId: "string — Stripe customer ID (cus_...)",
      },
    },
    {
      id: "create_payment_intent",
      displayName: "Create Payment Intent",
      description: "Create a payment intent to charge a customer",
      inputSchema: {
        amount:     "number — Amount in smallest currency unit (e.g. cents)",
        currency:   "string — Three-letter ISO currency code (e.g. usd)",
        customerId: "string — Stripe customer ID",
      },
      outputSchema: {
        paymentIntentId: "string — Stripe payment intent ID (pi_...)",
        clientSecret:    "string — Client secret for frontend confirmation",
      },
    },
    {
      id: "create_subscription",
      displayName: "Create Subscription",
      description: "Subscribe a customer to a price plan",
      inputSchema: {
        customerId: "string — Stripe customer ID",
        priceId:    "string — Stripe price ID (price_...)",
      },
      outputSchema: {
        subscriptionId: "string — Stripe subscription ID (sub_...)",
        status:         "string — Subscription status",
      },
    },
    {
      id: "issue_refund",
      displayName: "Issue Refund",
      description: "Refund a payment",
      inputSchema: {
        paymentIntentId: "string — Stripe payment intent ID to refund",
        amount:          "number? — Partial refund amount in cents (omit for full refund)",
      },
      outputSchema: {
        refundId: "string — Stripe refund ID (re_...)",
        status:   "string — Refund status",
      },
    },
  ],
};

export default stripe;