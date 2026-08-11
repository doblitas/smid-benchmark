import { NextResponse } from "next/server";
import { syncAnalysis } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const job = await syncAnalysis(id);
  if (!job) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
