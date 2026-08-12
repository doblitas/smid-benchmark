"use client";

import { useEffect, useState } from "react";
import type { AnalysisJob } from "@/lib/types";
import { cacheJob, readCachedJob } from "@/lib/job-cache";
import { ReportView } from "./ReportView";

const statusLabel: Record<AnalysisJob["status"], string> = {
  queued: "En cola",
  running: "Analizando competencia…",
  building_report: "Preparando reporte…",
  completed: "Completado",
  failed: "No se pudo completar",
};

const sourceLabel: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  press: "Medios digitales",
};

const runStatusLabel: Record<string, string> = {
  READY: "En cola",
  RUNNING: "En curso",
  SUCCEEDED: "Listo",
  FAILED: "Sin datos",
  ABORTED: "Cancelado",
  "TIMED-OUT": "Tiempo agotado",
};

export function AnalysisStatus({ id }: { id: string }) {
  const [job, setJob] = useState<AnalysisJob | null>(() =>
    readCachedJob<AnalysisJob>(id),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
        const data = await res.json();

        if (res.status === 404) {
          const cached = readCachedJob<AnalysisJob>(id);
          if (cached) {
            if (cancelled) return;
            setJob(cached);
            setError(null);
            if (cached.status !== "completed" && cached.status !== "failed") {
              timer = setTimeout(poll, 2500);
            }
            return;
          }
          throw new Error(
            "No encontramos este análisis. Vuelve a Nuevo análisis y genera otro reporte.",
          );
        }

        if (!res.ok) throw new Error(data.error || "No se pudo cargar el análisis");
        if (cancelled) return;
        setJob(data.job);
        cacheJob(data.job);
        setError(null);
        if (data.job.status !== "completed" && data.job.status !== "failed") {
          timer = setTimeout(poll, 2500);
        }
      } catch (err) {
        if (cancelled) return;
        const cached = readCachedJob<AnalysisJob>(id);
        if (cached?.status === "completed" || cached?.status === "failed") {
          setJob(cached);
          setError(null);
          return;
        }
        setError(err instanceof Error ? err.message : "No se pudo actualizar el estado");
        timer = setTimeout(poll, 4000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error && !job) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!job) {
    return <p className="text-sm text-[var(--muted)]">Cargando análisis…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Análisis {job.id.slice(0, 8)}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-[var(--ink)]">
              {job.input.clientBrand} vs {job.input.competitors.join(", ")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {job.input.country} · {job.input.category} · {job.input.periodLabel}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block border border-[var(--line)] bg-[var(--soft)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {statusLabel[job.status]}
            </span>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {job.mode === "demo" ? "Muestra ilustrativa" : "Captura del periodo"}
            </p>
          </div>
        </div>

        {job.runs.length > 0 && (
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {job.runs.map((run) => (
              <div
                key={`${run.source}-${run.runId}`}
                className="border border-[var(--line)] p-3 text-sm"
              >
                <div className="font-semibold">
                  {sourceLabel[run.source] || run.source}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {runStatusLabel[run.status] || run.status}
                  {typeof run.itemCount === "number" ? ` · ${run.itemCount} señales` : ""}
                </div>
                {run.error && (
                  <div className="mt-1 text-xs text-red-700">{run.error}</div>
                )}
                {!run.error && run.status === "FAILED" && (
                  <div className="mt-1 text-xs text-red-700">
                    No se pudo completar esta fuente.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {job.logs.length > 0 && (
          <div className="mt-5 max-h-40 overflow-auto bg-[var(--bg)] p-3 font-mono text-xs text-[var(--muted)]">
            {job.logs.slice(-8).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}

        {job.error && (
          <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {job.error}
          </p>
        )}
      </div>

      {job.report && <ReportView report={job.report} />}
    </div>
  );
}
