import Link from "next/link";
import { hasApifyToken } from "@/lib/apify";
import { listJobs } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await listJobs();
  const apifyReady = hasApifyToken();

  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Inteligencia publicitaria · Bolivia
        </p>
        <h1 className="font-serif text-5xl leading-none text-[var(--ink)]">
          De inputs a reporte SMID en un flujo
        </h1>
        <p className="text-[var(--muted)]">
          Cargas empresa, competencia, datos propios y fuentes. La app corre Apify
          (Meta, Google, prensa) y entrega el benchmark con temáticas, SOV e
          inversión estimada.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/nuevo"
            className="bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--bg)]"
          >
            Empezar nuevo análisis
          </Link>
          <span className="border border-[var(--line)] bg-[var(--soft)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Apify {apifyReady ? "conectado" : "modo demo"}
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            n: "01",
            t: "Inputs",
            d: "Cliente, competencia, periodo, fuentes y datos que ya tienes.",
          },
          {
            n: "02",
            t: "Captura",
            d: "Actors de Apify para Meta, Google y medios externos.",
          },
          {
            n: "03",
            t: "Reporte",
            d: "Entregable SMID con SOV e inversión estimada.",
          },
        ].map((step) => (
          <div key={step.n} className="border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="text-xs text-[var(--muted)]">{step.n}</div>
            <div className="mt-2 font-serif text-2xl">{step.t}</div>
            <p className="mt-2 text-sm text-[var(--muted)]">{step.d}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Análisis recientes</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Aún no hay corridas. Crea la primera desde{" "}
            <Link href="/nuevo" className="underline">
              Nuevo análisis
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--paper)]">
            {jobs.slice(0, 8).map((job) => (
              <Link
                key={job.id}
                href={`/analisis/${job.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[var(--soft)]"
              >
                <span>
                  <strong>{job.input.clientBrand}</strong> vs{" "}
                  {job.input.competitors.join(", ")}
                </span>
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {job.status} · {job.mode}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
