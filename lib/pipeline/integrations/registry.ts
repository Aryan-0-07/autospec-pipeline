// lib/pipeline/integrations/registry.ts
import type { IntegrationDefinition } from "@/lib/types";

import slack         from "./definitions/slack";
import stripe        from "./definitions/stripe";
import whatsapp      from "./definitions/whatsapp";
import gmail         from "./definitions/gmail";
import webhook       from "./definitions/webhook";
import notion        from "./definitions/notion";
import airtable      from "./definitions/airtable";
import hubspot       from "./definitions/hubspot";
import salesforce    from "./definitions/salesforce";
import jira          from "./definitions/jira";
import github        from "./definitions/github";
import twilio        from "./definitions/twilio";
import zapier        from "./definitions/zapier";
import google_sheets from "./definitions/google_sheets";

// ─────────────────────────────────────────
// Master registry — all integrations
// ─────────────────────────────────────────

const REGISTRY: IntegrationDefinition[] = [
  slack,
  stripe,
  whatsapp,
  gmail,
  webhook,
  notion,
  airtable,
  hubspot,
  salesforce,
  jira,
  github,
  twilio,
  zapier,
  google_sheets,
];

// Build lookup map for O(1) access
const REGISTRY_MAP = new Map<string, IntegrationDefinition>(
  REGISTRY.map((i) => [i.id, i])
);

// ─────────────────────────────────────────
// Registry access functions
// ─────────────────────────────────────────

export function getAllIntegrations(): IntegrationDefinition[] {
  return REGISTRY;
}

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return REGISTRY_MAP.get(id);
}

export function isValidIntegration(id: string): boolean {
  return REGISTRY_MAP.has(id);
}

export function isValidAction(integrationId: string, actionId: string): boolean {
  const integration = REGISTRY_MAP.get(integrationId);
  if (!integration) return false;
  return integration.actions.some((a) => a.id === actionId);
}

export function getImplementedIntegrations(): IntegrationDefinition[] {
  return REGISTRY.filter((i) => i.implemented);
}

export function getStubIntegrations(): IntegrationDefinition[] {
  return REGISTRY.filter((i) => !i.implemented);
}

export function validateIntegrationHook(
  integrationId: string,
  actionId: string
): { valid: boolean; error?: string } {
  if (!isValidIntegration(integrationId)) {
    return { valid: false, error: `Unknown integration: "${integrationId}"` };
  }
  if (!isValidAction(integrationId, actionId)) {
    return { valid: false, error: `Unknown action "${actionId}" for integration "${integrationId}"` };
  }
  return { valid: true };
}