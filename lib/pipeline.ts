import {
  fetchRunDatasets,
  hasApifyToken,
  isTerminalRunStatus,
  refreshRuns,
  startSourceRuns,
} from "./apify";
import { scanPressMedia, useNativePressCapture } from "./press";
import { appendLog, buildDemoReport, buildLiveReport } from "./report";
import { getJob, saveJob, updateJob } from "./store";
import { humanizeCaptureError } from "./errors";
import type { ActorRunRef, AnalysisInput, AnalysisJob, SourceKey } from "./types";

/** Cache corta de prensa nativa por job (evita re-fetch en finalize). */
const pressItemsByJob = new Map<string, Record<string, unknown>[]>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceLabel(source: SourceKey) {
  if (source === "meta") return "Meta Ads";
  if (source === "google") return "Google Ads";
  return "Medios digitales";
}

function splitSources(sources: SourceKey[]) {
  const nativePress = useNativePressCapture();
  const pressNative = nativePress && sources.includes("press");
  const apifySources = sources.filter((s) => !(pressNative && s === "press"));
  return { pressNative, apifySources };
}

async function runNativePress(input: AnalysisInput): Promise<{
  ref: ActorRunRef;
  items: Record<string, unknown>[];
}> {
  const items = await scanPressMedia(input);
  const okCount = items.filter((i) => !i.error).length;
  const firstError = items.find((i) => i.error)?.error;
  const ref: ActorRunRef = {
    source: "press",
    actorId: "native-press-scanner",
    runId: "native",
    // Si al menos un portal respondió, la fuente cuenta como OK (aunque no haya mención de marca).
    status: okCount > 0 ? "SUCCEEDED" : "FAILED",
    itemCount: items.length,
    datasetId: undefined,
    error:
      okCount > 0
        ? undefined
        : humanizeCaptureError("press", firstError),
  };
  return { ref, items: items as unknown as Record<string, unknown>[] };
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
      ? "Preparando muestra ilustrativa del reporte SMID…"
      : "Recopilando señales publicitarias de las fuentes seleccionadas…",
  );
  await saveJob(job);

  // En Vercel el fire-and-forget se corta al responder. Demo: completar en el request.
  // Live: waitUntil mantiene el trabajo vivo tras el response.
  if (useDemo) {
    await processAnalysis(id);
    return (await getJob(id)) ?? job;
  }

  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(processAnalysis(id));
  } catch {
    // Local / sin @vercel/functions
    void processAnalysis(id);
  }

  return job;
}

/** Arma el reporte a partir de runs ya terminados (no relanza fuentes). */
export async function finalizeLiveReport(id: string) {
  const job = await getJob(id);
  if (!job || job.mode !== "live") return;
  if (job.report) return;

  await updateJob(id, {
    status: "building_report",
    logs: appendLog(job, "Consolidando hallazgos y armando el reporte…").logs,
  });

  let current = (await getJob(id))!;
  const datasets = await fetchRunDatasets(current.runs);

  if (
    current.input.sources.includes("press") &&
    useNativePressCapture() &&
    (!datasets.press || datasets.press.length === 0)
  ) {
    try {
      const cached = pressItemsByJob.get(id);
      const press =
        cached ||
        ((await scanPressMedia(current.input)) as unknown as Record<
          string,
          unknown
        >[]);
      datasets.press = press;
      const okCount = press.filter((p) => !p.error).length;
      const runs = current.runs.map((r) =>
        r.source === "press"
          ? {
              ...r,
              status: (okCount > 0 ? "SUCCEEDED" : "FAILED") as string,
              itemCount: press.length,
              error:
                okCount > 0
                  ? undefined
                  : r.error || "No se pudo leer ningún medio digital",
            }
          : r,
      );
      await updateJob(id, { runs });
      current = (await getJob(id))!;
    } catch {
      datasets.press = datasets.press || [];
    }
  }

  const failedSources = current.runs
    .filter((r) => isTerminalRunStatus(r.status) && r.status !== "SUCCEEDED")
    .map((r) => sourceLabel(r.source));

  const report = buildLiveReport(current.input, datasets, {
    failedSources,
  });

  pressItemsByJob.delete(id);

  const finalJob = await getJob(id);
  if (!finalJob) return;
  await updateJob(id, {
    status: "completed",
    report,
    logs: appendLog(
      finalJob,
      failedSources.length > 0
        ? `Reporte listo (parcial: sin datos de ${failedSources.join(", ")}).`
        : "Reporte listo.",
    ).logs,
  });
}

export async function processAnalysis(id: string) {
  const current = await getJob(id);
  if (!current) return;

  try {
    if (current.mode === "demo") {
      await updateJob(id, {
        status: "running",
        logs: appendLog(current, "Analizando competencia…").logs,
      });
      await sleep(1200);

      const mid = await getJob(id);
      if (!mid) return;
      await updateJob(id, {
        status: "building_report",
        logs: appendLog(mid, "Preparando reporte SMID…").logs,
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

    // Si ya hay runs y están terminales sin reporte, solo finalizar.
    if (
      current.runs.length > 0 &&
      current.runs.every((r) => isTerminalRunStatus(r.status)) &&
      !current.report
    ) {
      await finalizeLiveReport(id);
      return;
    }

    await updateJob(id, {
      status: "running",
      logs: appendLog(
        current,
        "Recopilando señales de Meta Ads, Google Ads y medios…",
      ).logs,
    });

    const { pressNative, apifySources } = splitSources(current.input.sources);

    const pressPromise = pressNative
      ? runNativePress(current.input)
      : Promise.resolve(null);

    const apifyPromise =
      apifySources.length > 0
        ? startSourceRuns(current.input, apifySources)
        : Promise.resolve([] as ActorRunRef[]);

    const [pressResult, apifyRuns] = await Promise.all([pressPromise, apifyPromise]);

    const runs: ActorRunRef[] = [...apifyRuns];
    if (pressResult) {
      runs.push(pressResult.ref);
      pressItemsByJob.set(id, pressResult.items);
    }

    let job = await getJob(id);
    if (!job) return;
    const sourceNames = runs.map((r) => sourceLabel(r.source)).join(", ");
    job = {
      ...appendLog(job, `Fuentes en análisis: ${sourceNames}.`),
      runs,
    };
    await saveJob(job);

    // Poll Apify runs hasta ~90s. Prensa nativa ya está terminal.
    const needsPoll = runs.some(
      (r) => r.runId && r.runId !== "native" && !isTerminalRunStatus(r.status),
    );
    if (needsPoll) {
      const started = Date.now();
      while (Date.now() - started < 90_000) {
        await sleep(5000);
        job = (await getJob(id))!;
        const refreshed = await refreshRuns(job.runs);
        job = {
          ...appendLog(job, "Actualizando progreso del análisis…"),
          runs: refreshed,
        };
        await saveJob(job);

        if (refreshed.every((r) => isTerminalRunStatus(r.status))) break;
      }
    }

    // Prensa nativa se re-escanea en finalize (barato) si no hay dataset Apify.
    await finalizeLiveReport(id);
  } catch (error) {
    // Último recurso: intentar reporte parcial en vez de fallar todo el job.
    try {
      const failed = await getJob(id);
      if (!failed) return;
      if (failed.mode === "live" && !failed.report) {
        const datasets = await fetchRunDatasets(failed.runs);
        if (failed.input.sources.includes("press") && useNativePressCapture()) {
          try {
            datasets.press = (await scanPressMedia(
              failed.input,
            )) as unknown as Record<string, unknown>[];
          } catch {
            datasets.press = [];
          }
        }
        const failedSources = failed.runs
          .filter((r) => r.status !== "SUCCEEDED")
          .map((r) => sourceLabel(r.source));
        const report = buildLiveReport(failed.input, datasets, { failedSources });
        await updateJob(id, {
          status: "completed",
          report,
          logs: appendLog(
            failed,
            "Reporte listo con cobertura parcial tras un error intermedio.",
          ).logs,
        });
        return;
      }
    } catch {
      // caer al failed total
    }

    const failed = await getJob(id);
    if (!failed) return;
    await updateJob(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Error desconocido",
      logs: appendLog(failed, "No se pudo completar el análisis.").logs,
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

    const allDone = refreshed.every((r) => isTerminalRunStatus(r.status));

    // Finalizar con lo disponible (incluso si todas fallaron → reporte parcial vacío).
    if (allDone && !job.report) {
      void finalizeLiveReport(id);
    }
    return getJob(id);
  }

  return job;
}
