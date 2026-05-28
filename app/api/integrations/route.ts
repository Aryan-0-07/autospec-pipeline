// app/api/integrations/route.ts
import { NextResponse } from "next/server";
import { getAllIntegrations } from "@/lib/pipeline/integrations/registry";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAllIntegrations());
}