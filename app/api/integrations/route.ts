export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getAllIntegrations } from "@/lib/pipeline/integrations/registry";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAllIntegrations());
}