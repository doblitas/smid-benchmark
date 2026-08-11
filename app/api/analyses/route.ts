import { NextResponse } from "next/server";
import { createAndStartAnalysis } from "@/lib/pipeline";
import { analysisInputSchema } from "@/lib/schema";
import { listJobs } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      mode: j.mode,
      createdAt: j.createdAt,
      clientBrand: j.input.clientBrand,
      competitors: j.input.competitors,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = analysisInputSchema.parse(body);
    const competitors = parsed.competitors
      .flatMap((c) => c.split(","))
      .map((c) => c.trim())
      .filter(Boolean);

    const job = await createAndStartAnalysis({
      ...parsed,
      competitors,
      pressMedia: parsed.pressMedia
        .flatMap((m) => m.split(","))
        .map((m) => m.trim())
        .filter(Boolean),
    });

    return NextResponse.json({ id: job.id, job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo crear el análisis",
      },
      { status: 400 },
    );
  }
}
