import {
  fetchDatasetItems,
  hasApifyToken,
  refreshRuns,
  startSourceRuns,
} from "./apify";
import { appendLog, buildDemoReport, buildLiveReport } from "./report";
import { getJob, saveJob, updateJob } from "./store";
import type { AnalysisInput, AnalysisJob } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createAndStartAnalysis(
  input: AnalysisInput,
): Promise<AnalysisJob> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const useDemo = input.forceDemo || !hasApifyToken();

  let job: AnalysisJob = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "queued",
    input,
    mode: useDemo ? "demo" : "live",
    runs: [],
    logs: [],
  };

  job = appendLog(
    job,
    useDemo
      ? "Modo demo: se generará el reporte SMID sin Actors (falta APIFY_TOKEN o forceDemo)."
      : "Modo live: iniciando Actors de Apify.",
  );
  await saveJob(job);

  // Fire-and-forget processing (best effort en serverless).
  void processAnalysis(id);

  return job;
}

export async function processAnalysis(id: string) {
  const current = await getJob(id);
  if (!current) return;

  try {
    if (current.mode === "demo") {
      await updateJob(id, {
        status: "running",
        logs: appendLog(current, "Simulando captura competitiva...").logs,
      });
      await sleep(1200);

      const mid = await getJob(id);
      if (!mid) return;
      await updateJob(id, {
        status: "building_report",
        logs: appendLog(mid, "Construyendo reporte SMID...").logs,
      });
      await sleep(800);

      const report = buildDemoReport(current.input);
      const done = await getJob(id);
      if (!done) return;
      await updateJob(id, {
        status: "completed",
        report,
        logs: appendLog(done, "Reporte listo.").logs,
      });
      return;
    }

    await updateJob(id, {
      status: "running",
      logs: appendLog(current, "Lanzando Actors seleccionados...").logs,
    });

    const runs = await startSourceRuns(current.input, current.input.sources);
    let job = await getJob(id);
    if (!job) return;
    job = {
      ...appendLog(job, `Actors iniciados: ${runs.map((r) => r.source).join(", ")}`),
      runs,
    };
    await saveJob(job);

    // Poll hasta 90s (adecuado para preview; jobs largos pueden quedar running y refinarse luego).
    const started = Date.now();
    while (Date.now() - started < 90_000) {
      await sleep(5000);
      job = (await getJob(id))!;
      const refreshed = await refreshRuns(job.runs);
      job = {
        ...appendLog(job, "Consultando estado de Actors..."),
        runs: refreshed,
      };
      await saveJob(job);

      const terminal = refreshed.every((r) =>
        ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(r.status),
      );
      if (terminal) break;
    }

    job = (await getJob(id))!;
    await updateJob(id, {
      status: "building_report",
      logs: appendLog(job, "Descargando datasets y armando reporte...").logs,
    });

    const datasets: Record<string, Record<string, unknown>[]> = {};
    for (const run of (await getJob(id))!.runs) {
      if (run.datasetId && run.status === "SUCCEEDED") {
        datasets[run.source] = await fetchDatasetItems(run.datasetId, 100);
      } else {
        datasets[run.source] = [];
      }
    }

    const report = buildLiveReport(current.input, datasets);
    const finalJob = await getJob(id);
    if (!finalJob) return;
    await updateJob(id, {
      status: "completed",
      report,
      logs: appendLog(finalJob, "Reporte live listo.").logs,
    });
  } catch (error) {
    const failed = await getJob(id);
    if (!failed) return;
    await updateJob(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Error desconocido",
      logs: appendLog(
        failed,
        `Error: ${error instanceof Error ? error.message : "desconocido"}`,
      ).logs,
    });
  }
}

export async function syncAnalysis(id: string) {
  const job = await getJob(id);
  if (!job) return null;

  if (job.status === "completed" || job.status === "failed") return job;

  if (job.mode === "live" && job.runs.length > 0) {
    const refreshed = await refreshRuns(job.runs);
    const next = { ...job, runs: refreshed, updatedAt: new Date().toISOString() };
    await saveJob(next);

    const allDone = refreshed.every((r) =>
      ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(r.status),
    );
    const anySuccess = refreshed.some((r) => r.status === "SUCCEEDED");

    if (allDone && anySuccess && !job.report) {
      void processAnalysis(id);
    }
    return getJob(id);
  }

  return job;
}
