import { NextResponse } from "next/server";
import { processAnalysis } from "@/lib/pipeline";
import { getJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  void processAnalysis(id);
  return NextResponse.json({ ok: true, id });
}
